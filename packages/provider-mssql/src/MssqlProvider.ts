import type {
  EntityMetadata,
  ColumnMetadata,
  SqlLogger,
  RetryPolicy,
  SqlParameter,
  OrmMiddleware,
  SoftDeleteOptions,
  SqlDialect,
  ConnectionPoolOptions,
  ConnectionHealthCheckOptions
} from '@ts-linq/core';
import {
  DatabaseProvider,
  OptimisticConcurrencyError,
  MetadataStorage,
  SqlHelper
} from '@ts-linq/core';
import { MssqlDialect } from '@ts-linq/dialect-mssql';
import { MssqlDdlStrategy } from '@ts-linq/dialect-mssql';

interface MssqlRequestLike {
  input(name: string, value: SqlParameter): MssqlRequestLike;
  query(sql: string): Promise<{ recordset?: unknown[]; rowsAffected?: number[] }>;
  batch(sql: string): Promise<void>;
}
interface MssqlConnectionPoolLike {
  connect(): Promise<void>;
  close(): Promise<void>;
}
interface MssqlTransactionLike {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
interface MssqlLike {
  ConnectionPool: new (connectionString: string) => MssqlConnectionPoolLike;
  Request: new (parent: MssqlTransactionLike | MssqlConnectionPoolLike) => MssqlRequestLike;
  Transaction: new (parent: MssqlConnectionPoolLike) => MssqlTransactionLike;
}

/**
 * Microsoft SQL Server provider based on the `mssql` package.
 *
 * Responsibilities:
 * - Connection pooling and lifecycle
 * - DDL generation for basic table/index creation
 * - DML helpers for insert/update/delete/find operations
 * - Transaction management (begin/commit/rollback)
 * - Parameter style mapping (`?` → `@p1..@pn`)
 *
 * @example
 * import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
 *
 * @Entity({ name: 'Users' })
 * class User {
 *   @PrimaryKey({ autoIncrement: true }) id!: number;
 *   @Column({ type: 'TEXT', nullable: false }) name!: string;
 * }
 *
 * class AppCtx extends DbContext {
 *   public users!: DbSet<User>;
 *   constructor() { super({ provider: 'mssql', connectionString: process.env.MSSQL_URL! }); }
 * }
 *
 * async function run() {
 *   const ctx = new AppCtx();
 *   await ctx.ensureCreated();
 *   const user = new User(); user.name = 'Alice';
 *   ctx.users.add(u);
 *   await ctx.saveChanges();
 *   const all = await ctx.users.toArray();
 *   await ctx.dispose();
 * }
 */
export class MssqlProvider extends DatabaseProvider {
  private pool: MssqlConnectionPoolLike | null = null;
  private tx: MssqlTransactionLike | null = null;
  private ddl = new MssqlDdlStrategy();
  /** Create provider with MSSQL connection string. */
  constructor(
    connectionString: string,
    logger?: SqlLogger,
    middlewares?: OrmMiddleware[],
    softDelete?: SoftDeleteOptions,
    retryPolicy?: RetryPolicy,
    poolOptions?: ConnectionPoolOptions,
    healthCheck?: ConnectionHealthCheckOptions
  ) {
    super(connectionString, logger, middlewares, softDelete, retryPolicy, poolOptions, healthCheck);
    this.providerName = 'mssql';
  }

  /** Open a connection pool to MSSQL server. */
  public async connect(): Promise<void> {
    if (this.isConnected) return;
    const mssql = safeRequireMssql();
    // Map generic pool options into mssql.ConnectionPool config if available
    const opts = this.poolOptions || {};
    const config: Record<string, unknown> = { connectionString: this.connectionString };
    if (typeof opts.max === 'number') config.pool = { ...(config.pool as object), max: opts.max };
    if (typeof opts.min === 'number') config.pool = { ...(config.pool as object), min: opts.min };
    if (typeof opts.idleTimeoutMs === 'number')
      config.pool = { ...(config.pool as object), idleTimeoutMillis: opts.idleTimeoutMs };
    if (typeof opts.acquireTimeoutMs === 'number')
      config.pool = { ...(config.pool as object), acquireTimeoutMillis: opts.acquireTimeoutMs };
    if (typeof opts.connectionTimeoutMs === 'number')
      config.connectionTimeout = opts.connectionTimeoutMs;
    this.pool = new (
      mssql as unknown as { ConnectionPool: new (cfg: unknown) => MssqlConnectionPoolLike }
    ).ConnectionPool(config);
    await this.pool.connect();
    this.isConnected = true;
    // Health checks
    this.startHealthChecks(async () => {
      const started = Date.now();
      const req = new (
        mssql as unknown as {
          Request: new (parent: MssqlTransactionLike | MssqlConnectionPoolLike) => MssqlRequestLike;
        }
      ).Request(this.pool!);
      const sql = 'SELECT 1';
      await req.query(sql);
      return Date.now() - started;
    });
  }

  /** Close transaction (if any) and dispose the pool. */
  public async disconnect(): Promise<void> {
    this.stopHealthChecks();
    if (this.tx) {
      try {
        await this.tx.rollback();
      } catch {
        /* ignore */
      }
      this.tx = null;
    }
    if (this.pool) {
      try {
        await this.pool.close();
      } catch {
        /* ignore */
      }
      this.pool = null;
    }
    this.isConnected = false;
  }

  /** Create table and indexes using entity metadata if absent. */
  public async createTable(entityMetadata: EntityMetadata): Promise<void> {
    const sql = this.ddl.generateCreateTableSql(entityMetadata);
    await this.executeNonQuery(sql);
    // Indexes
    for (const index of entityMetadata.indexes) {
      const idxSql = this.ddl.generateCreateIndexSql(entityMetadata.tableName, {
        ...index,
        unique: index.unique ?? false
      });
      await this.executeNonQuery(idxSql);
    }
  }

  /** Insert entity row; when PK is IDENTITY, sets generated value via SCOPE_IDENTITY(). */
  public async insert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);

    const { sql, params, returningPk } = this.generateInsertSql(
      entity as Record<string, unknown>,
      metadata
    );
    // For MSSQL, to retrieve identity we need a separate SELECT SCOPE_IDENTITY() or OUTPUT clause.
    const affected = await this.executeNonQuery(sql, params);
    if (affected > 0 && returningPk) {
      const rows = await this.executeQuery<{ id: number }>(
        'SELECT CAST(SCOPE_IDENTITY() AS INT) AS id'
      );
      const id = rows && rows[0]?.id;
      if (id !== undefined) {
        (entity as Record<string, unknown>)[returningPk] = id as unknown as SqlParameter;
      }
    }
    return entity;
  }

  /** Update entity row by primary key. Throws if no rows affected. */
  public async update<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const versionCol = metadata.columns.find((c) => c.isVersion);
    const { sql, params } = this.generateUpdateSql(
      entity as Record<string, unknown>,
      metadata,
      versionCol
    );
    const affectedRows = await this.executeNonQuery(sql, params);
    if (affectedRows === 0) {
      if (versionCol) throw new OptimisticConcurrencyError('Version mismatch detected during update');
      throw new Error('No rows were updated.');
    }
    if (versionCol) {
      const prop = versionCol.propertyName;
      const rec = entity as Record<string, unknown>;
      const cur = typeof rec[prop] === 'number' ? rec[prop] : Number(rec[prop] ?? 0);
      rec[prop] = cur + 1;
    }
    return entity;
  }

  /** Delete entity row by primary key. Throws if no rows affected. */
  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { sql, params } = this.generateDeleteSql(entity as Record<string, unknown>, metadata);
    const affectedRows = await this.executeNonQuery(sql, params);
    if (affectedRows === 0) throw new Error('No rows were deleted.');
  }

  /** Upsert using MERGE statement (simplified). */
  public async upsert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      return this.insert(entity, entityClass);
    }
    const pk = metadata.primaryKeys;

    const updatable = metadata.columns.filter(
      (c) => !pk.includes(c.propertyName) && !c.isGenerated && !c.isComputed
    );
    const sourceCols = metadata.columns.filter((c) => !c.isGenerated);

    const sourceSelect = sourceCols.map((c) => `? AS ${c.columnName}`).join(', ');
    const onClause = pk
      .map((k) => {
        const col = metadata.columns.find((c) => c.propertyName === k)!;
        return `t.${col.columnName} = s.${col.columnName}`;
      })
      .join(' AND ');
    const setClause = updatable.map((c) => `t.${c.columnName} = s.${c.columnName}`).join(', ');
    const insertCols = sourceCols.map((c) => c.columnName).join(', ');
    const insertVals = sourceCols.map((c) => `s.${c.columnName}`).join(', ');
    const params: SqlParameter[] = sourceCols.map((c) =>
      this.coerceToSqlParameter((entity as Record<string, unknown>)[c.propertyName])
    );

    const sql =
      `MERGE ${metadata.tableName} AS t USING (SELECT ${sourceSelect}) AS s ON (${onClause}) ` +
      (setClause ? `WHEN MATCHED THEN UPDATE SET ${setClause} ` : '') +
      `WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals});`;
    await this.executeNonQuery(sql, params);
    return entity;
  }

  /** Find a single entity by its primary key value. */
  public async findById<T extends object>(
    id: unknown,
    entityClass: new () => T
  ): Promise<T | null> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      throw new Error(`No primary key defined for ${entityClass.name}`);
    }
    const pk = metadata.primaryKeys[0];
    const pkCol = metadata.columns.find((c) => c.propertyName === pk)!;
    let sql = `SELECT * FROM ${metadata.tableName} WHERE ${pkCol.columnName} = ?`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND ${flag} = 0`;
    }
    const rows = await this.executeQuery<Record<string, unknown>>(sql, [
      this.coerceToSqlParameter(id)
    ]);
    if (rows.length === 0) return null;
    return this.mapRowToEntity(rows[0], entityClass);
  }

  /** Return all entities of the given type. */
  public async findAll<T extends object>(entityClass: new () => T): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    let sql = `SELECT * FROM ${metadata.tableName}`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` WHERE ${flag} = 0`;
    }
    const rows = await this.executeQuery<Record<string, unknown>>(sql);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  /** Find entities by simple conditions object (column equals). */
  public async findWhere<T extends object>(
    entityClass: new () => T,
    conditions: Record<string, unknown>
  ): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { whereClause, params } = SqlHelper.buildWhereClause(conditions);
    let sql = `SELECT * FROM ${metadata.tableName} WHERE ${whereClause}`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND ${flag} = 0`;
    }
    const rows = await this.executeQuery<Record<string, unknown>>(sql, params);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  /** Find entities where a column value is in the given array (IN clause). */
  public async findWhereIn<T extends object>(
    entityClass: new () => T,
    column: string,
    values: unknown[]
  ): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    if (!Array.isArray(values) || values.length === 0) return [];
    const columnMeta = metadata.columns.find(
      (c) => c.propertyName === column || c.columnName === column
    );
    const columnName = columnMeta ? columnMeta.columnName : column;
    const placeholders = values.map(() => '?').join(', ');
    let sql = `SELECT * FROM ${metadata.tableName} WHERE ${columnName} IN (${placeholders})`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND ${flag} = 0`;
    }
    const coerced: SqlParameter[] = values.map((v) => this.coerceToSqlParameter(v));
    const rows = await this.executeQuery<Record<string, unknown>>(sql, coerced);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  /** Execute a SQL query and return the recordset rows. */
  protected async doExecuteQuery<T>(
    _sql: string,
    _params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    if (!this.isConnected) await this.connect();
    const mssql = safeRequireMssql();
    const { sql, params } = prepareMssqlSql(_sql, _params || []);
    const request = new mssql.Request(this.tx || this.pool!);
    params.forEach((value, i) => request.input(`p${i + 1}`, value));
    try {
      const result = await request.query(sql);
      return (result.recordset || []) as T[];
    } catch (e: unknown) {
      throw mapMssqlError(e);
    }
  }

  /** Execute a non-query SQL statement and return affected rows count. */
  protected async doExecuteNonQuery(
    _sql: string,
    _params: readonly SqlParameter[] = []
  ): Promise<number> {
    if (!this.isConnected) await this.connect();
    const mssql = safeRequireMssql();
    const { sql, params } = prepareMssqlSql(_sql, _params || []);
    const request = new mssql.Request(this.tx || this.pool!);
    params.forEach((value, i) => request.input(`p${i + 1}`, value));
    try {
      const result = await request.query(sql);
      const rowsAffected: number[] = result.rowsAffected || [];
      return rowsAffected.reduce((sum, n) => sum + (n || 0), 0);
    } catch (e: unknown) {
      throw mapMssqlError(e);
    }
  }

  /** Obtain SQL Server execution plan via SHOWPLAN_TEXT (best-effort, non-executing). */
  protected async getExplainPlan(
    sql: string,
    params: readonly SqlParameter[]
  ): Promise<unknown | undefined> {
    try {
      if (!this.isConnected) await this.connect();
      const mssql = safeRequireMssql();
      const request = new mssql.Request(this.tx || this.pool!);
      params.forEach((value, i) => request.input(`p${i + 1}`, value));
      try {
        await request.batch('SET SHOWPLAN_TEXT ON;');
        const res = await request.query(sql);
        await request.batch('SET SHOWPLAN_TEXT OFF;');
        return res.recordset;
      } catch {
        try {
          await request.batch('SET SHOWPLAN_XML ON;');
          const res = await request.query(sql);
          await request.batch('SET SHOWPLAN_XML OFF;');
          return res.recordset;
        } catch {
          return undefined;
        }
      }
    } catch {
      return undefined;
    }
  }

  /** Begin a database transaction. */
  public async beginTransaction(): Promise<void> {
    if (!this.isConnected) await this.connect();
    if (this.inTransaction) throw new Error('Transaction already in progress');
    const mssql = safeRequireMssql();
    this.tx = new mssql.Transaction(this.pool!);
    await this.tx.begin();
    this.inTransaction = true;
    this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
  }

  /** Commit the current transaction. */
  public async commitTransaction(): Promise<void> {
    if (!this.inTransaction || !this.tx) throw new Error('No transaction in progress');
    await this.tx.commit();
    this.tx = null;
    this.inTransaction = false;
    this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
  }

  /** Roll back the current transaction. */
  public async rollbackTransaction(): Promise<void> {
    if (!this.inTransaction || !this.tx) throw new Error('No transaction in progress');
    await this.tx.rollback();
    this.tx = null;
    this.inTransaction = false;
    this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
  }

  /** Provide SQL dialect for this provider. */
  public getDialect(): SqlDialect {
    return new MssqlDialect();
  }

  // Private helpers
  // DDL generation moved to MssqlDdlStrategy

  private generateInsertSql(
    entity: Record<string, unknown>,
    metadata: EntityMetadata
  ): { sql: string; params: SqlParameter[]; returningPk?: string } {
    const insertable = metadata.columns.filter(
      (col) => !col.isGenerated || entity[col.propertyName] !== undefined
    );
    const columnNames = insertable.map((c) => c.columnName);
    const placeholders = insertable.map(() => '?');
    const params: SqlParameter[] = insertable.map((c) =>
      this.coerceToSqlParameter(entity[c.propertyName])
    );
    const sql = `INSERT INTO ${metadata.tableName} (${columnNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const firstPk = metadata.primaryKeys?.[0];
    const returningPk =
      firstPk && metadata.columns.find((c) => c.propertyName === firstPk)?.isGenerated
        ? firstPk
        : undefined;
    return { sql, params, returningPk };
  }

  private generateUpdateSql(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata
  ): { sql: string; params: SqlParameter[] } {
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      throw new Error(`No primary key defined for entity ${metadata.tableName}`);
    }
    const primaryKeys = metadata.primaryKeys;
    const updatable = metadata.columns.filter(
      (c) => !primaryKeys.includes(c.propertyName) && !c.isGenerated
    );
    if (updatable.length === 0) throw new Error(`No updatable columns for ${metadata.tableName}`);
    const setClauses: string[] = updatable.map((c) => `${c.columnName} = ?`);
    const setParams: SqlParameter[] = updatable.map((c) =>
      this.coerceToSqlParameter(entity[c.propertyName])
    );
    if (versionCol) setClauses.push(`${versionCol.columnName} = ${versionCol.columnName} + 1`);
    const whereClauses: string[] = [];
    const whereParams: SqlParameter[] = [];
    for (const pk of primaryKeys) {
      const col = metadata.columns.find((c) => c.propertyName === pk)!;
      whereClauses.push(`${col.columnName} = ?`);
      whereParams.push(this.coerceToSqlParameter(entity[pk]));
    }
    if (versionCol) {
      whereClauses.push(`${versionCol.columnName} = ?`);
      whereParams.push(this.coerceToSqlParameter(entity[versionCol.propertyName]));
    }
    const sql = `UPDATE ${metadata.tableName} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    return { sql, params: [...setParams, ...whereParams] };
  }

  private generateDeleteSql(
    entity: Record<string, unknown>,
    metadata: EntityMetadata
  ): { sql: string; params: SqlParameter[] } {
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      throw new Error(`No primary key defined for entity ${metadata.tableName}`);
    }
    const whereClauses: string[] = [];
    const params: SqlParameter[] = [];
    for (const pk of metadata.primaryKeys) {
      const col = metadata.columns.find((c) => c.propertyName === pk)!;
      whereClauses.push(`${col.columnName} = ?`);
      params.push(this.coerceToSqlParameter(entity[pk]));
    }
    const sql = `DELETE FROM ${metadata.tableName} WHERE ${whereClauses.join(' AND ')}`;
    return { sql, params };
  }

  private mapRowToEntity<T extends object>(row: unknown, entityClass: new () => T): T {
    const entity = new entityClass();
    const metadata = MetadataStorage.getEntity(entityClass);
    if (metadata) {
      for (const column of metadata.columns) {
        if (Object.prototype.hasOwnProperty.call(row as object, column.columnName)) {
          (entity as Record<string, unknown>)[column.propertyName] = (
            row as Record<string, unknown>
          )[column.columnName];
        }
      }
    } else {
      Object.assign(entity as object, row as object);
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.notifyEntityMaterialized(entity, metadata);
    return entity;
  }

  private coerceToSqlParameter(value: unknown): SqlParameter {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value instanceof Date ||
      value instanceof Uint8Array
    ) {
      return value as SqlParameter;
    }
    try {
      return JSON.stringify(value ?? null) as unknown as SqlParameter;
    } catch {
      return String(value) as unknown as SqlParameter;
    }
  }
}

// Helpers
export function mapTypeToMssql(type: string): string {
  switch (type.toUpperCase()) {
    case 'TEXT':
    case 'STRING':
      return 'NVARCHAR(MAX)';
    case 'INTEGER':
    case 'NUMBER':
      return 'INT';
    case 'REAL':
    case 'FLOAT':
    case 'DOUBLE':
      return 'FLOAT';
    case 'BOOLEAN':
      return 'BIT';
    case 'DATETIME':
    case 'DATE':
      return 'DATETIME2';
    case 'BLOB':
      return 'VARBINARY(MAX)';
    case 'UUID':
      return 'UNIQUEIDENTIFIER';
    default:
      return 'NVARCHAR(MAX)';
  }
}

function prepareMssqlSql(
  sql: string,
  params: readonly SqlParameter[]
): { sql: string; params: SqlParameter[] } {
  if (!params || params.length === 0) return { sql, params: [] };
  let index = 0;
  const mapped = sql.replace(/\?/g, () => `@p${++index}`);
  return { sql: mapped, params: [...params] };
}

function safeRequireMssql(): MssqlLike {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('mssql');
  } catch (e) {
    throw new Error(
      'Package "mssql" is required for MssqlProvider. Install it with: npm install mssql'
    );
  }
}

function mapMssqlError(err: unknown): Error {
  const anyErr = err as { number?: number; message?: string } | undefined;
  const number = anyErr?.number;
  const message = anyErr?.message || String(err);
  if (number === 2627 || number === 2601) {
    return new (require('../types').UniqueConstraintError)(message, String(number));
  }
  const DatabaseError = require('../types').DatabaseError;
  return new DatabaseError(message, String(number));
}
