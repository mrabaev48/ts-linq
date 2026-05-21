import { DatabaseProvider, SqlHelper } from '@ts-linq/core';
import { MssqlDialect } from '@ts-linq/dialect-mssql';
import { MssqlDdlStrategy } from '@ts-linq/dialect-mssql';
import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityMetadata, MssqlConfig, SqlDialect, SqlParameter } from '@ts-linq/types';
import { DatabaseError, OptimisticConcurrencyError, UniqueConstraintError } from '@ts-linq/types';

import { buildMssqlConnectionString } from './buildConnectionString';
import { isMssqlTransientErrorNumber } from './transientErrorCodes';

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
  private readonly config: MssqlConfig;
  private ownsPool = true;

  /** Create provider with MSSQL configuration. */
  constructor(config: MssqlConfig) {
    const connectionString = buildMssqlConnectionString(config);
    super(
      connectionString,
      config.logger,
      config.middlewares,
      config.softDelete,
      config.retryPolicy,
      config.poolOptions,
      config.healthCheck
    );
    this.config = config;
    this.providerName = 'mssql';
  }

  public override formatSqlWithParams(
    rawSql: string,
    params: readonly SqlParameter[]
  ): { sql: string; params: readonly SqlParameter[] } {
    let index = 0;
    return { sql: rawSql.replace(/\?/g, () => `@p${++index}`), params };
  }

  /** Open a connection pool to MSSQL server. */
  protected async doConnect(): Promise<void> {
    if (this.isConnected) return;

    if (this.config.pool) {
      this.pool = this.config.pool as MssqlConnectionPoolLike;
      this.ownsPool = false;
    } else {
      const mssql = safeRequireMssql();
      const opts = this.poolOptions || {};
      // Build a proper mssql config object — ConnectionPool does not accept a
      // `connectionString` key; it expects { server, user, password, options: { port, ... } }
      const mssqlConfig: Record<string, unknown> = {
        server: this.config.server,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        options: {
          port: this.config.port ?? 1433,
          encrypt: this.config.encrypt ?? false,
          trustServerCertificate: this.config.trustServerCertificate ?? true,
          ...(this.config.instanceName ? { instanceName: this.config.instanceName } : {}),
          ...(this.config.domain ? { domain: this.config.domain } : {}),
          ...(this.config.applicationName ? { appName: this.config.applicationName } : {}),
          ...(this.config.options ?? {})
        }
      };
      if (typeof opts.connectionTimeoutMs === 'number') {
        mssqlConfig.connectionTimeout = opts.connectionTimeoutMs;
      }
      const pool: Record<string, unknown> = {};
      if (typeof opts.max === 'number') pool.max = opts.max;
      if (typeof opts.min === 'number') pool.min = opts.min;
      if (typeof opts.idleTimeoutMs === 'number') pool.idleTimeoutMillis = opts.idleTimeoutMs;
      if (typeof opts.acquireTimeoutMs === 'number')
        pool.acquireTimeoutMillis = opts.acquireTimeoutMs;
      if (Object.keys(pool).length > 0) mssqlConfig.pool = pool;
      this.pool = new (
        mssql as unknown as { ConnectionPool: new (cfg: unknown) => MssqlConnectionPoolLike }
      ).ConnectionPool(mssqlConfig);
      await this.pool.connect();
      this.ownsPool = true;
    }

    this.isConnected = true;
    // Health checks
    this.startHealthChecks(async () => {
      const mssql = safeRequireMssql();
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
  protected async doDisconnect(): Promise<void> {
    this.stopHealthChecks();
    if (this.tx) {
      try {
        await this.tx.rollback();
      } catch {
        /* ignore */
      }
      this.tx = null;
    }
    if (this.pool && this.ownsPool) {
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

    const dialect = this.getDialect() as MssqlDialect;
    const { sql, parameters, returningPk } = dialect.buildInsert(
      entity as Record<string, unknown>,
      metadata
    );

    // Use OUTPUT INSERTED to atomically retrieve the generated identity within the same statement.
    if (returningPk) {
      const rows = await this.executeQuery<{ id: number }>(sql, parameters);
      const id = rows && rows[0]?.id;
      if (id !== undefined) {
        (entity as Record<string, unknown>)[returningPk] = id;
      }
    } else {
      await this.executeNonQuery(sql, parameters);
    }
    return entity;
  }

  /** Update entity row by primary key. Throws if no rows affected. */
  public async update<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const versionCol = metadata.columns.find((c) => c.isVersion);

    const dialect = this.getDialect() as MssqlDialect;
    const { sql, parameters } = dialect.buildUpdate(
      entity as Record<string, unknown>,
      metadata,
      versionCol
    );

    const affectedRows = await this.executeNonQuery(sql, parameters);
    if (affectedRows === 0) {
      if (versionCol)
        throw new OptimisticConcurrencyError('Version mismatch detected during update');
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

    const dialect = this.getDialect() as MssqlDialect;
    const { sql, parameters } = dialect.buildDelete(entity as Record<string, unknown>, metadata);

    const affectedRows = await this.executeNonQuery(sql, parameters);
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
    // Source must include PK columns (even IDENTITY) so the ON clause can reference them.
    // But INSERT target must exclude IDENTITY columns — MSSQL auto-generates them for new rows.
    const sourceCols = metadata.columns.filter(
      (c) => !c.isGenerated || pk.includes(c.propertyName)
    );
    const insertableCols = sourceCols.filter((c) => !c.isGenerated);

    const sourceSelect = sourceCols.map((c) => `? AS ${c.columnName}`).join(', ');
    const onClause = pk
      .map((k) => {
        const col = metadata.columns.find((c) => c.propertyName === k)!;
        return `t.${col.columnName} = s.${col.columnName}`;
      })
      .join(' AND ');
    const setClause = updatable.map((c) => `t.${c.columnName} = s.${c.columnName}`).join(', ');
    const insertCols = insertableCols.map((c) => c.columnName).join(', ');
    const insertVals = insertableCols.map((c) => `s.${c.columnName}`).join(', ');
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

    const where: import('@ts-linq/types').WhereClause[] = [
      {
        condition: `${this.getDialect().quoteIdentifier(pkCol.columnName)} = ?`,
        parameters: [this.coerceToSqlParameter(id)]
      }
    ];

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where, limit: 1 });
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);

    if (rows.length === 0) return null;
    return this.mapRowToEntity(rows[0], entityClass);
  }

  /** Return all entities of the given type. */
  public async findAll<T extends object>(entityClass: new () => T): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);

    const where: import('@ts-linq/types').WhereClause[] = [];

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where });
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);
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

    const where: import('@ts-linq/types').WhereClause[] = [];
    if (whereClause) {
      where.push({
        condition: whereClause,
        parameters: params
      });
    }

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where });
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);
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
    const coerced = values.map((v) => this.coerceToSqlParameter(v));

    const where: import('@ts-linq/types').WhereClause[] = [
      {
        condition: `${this.getDialect().quoteIdentifier(columnName)} IN (${placeholders})`,
        parameters: coerced
      }
    ];

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where });
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  protected override buildChunkSql(baseSql: string, chunkLimit: number, offset: number): string {
    const hasOrderBy = /\bORDER\s+BY\b/i.test(baseSql);
    const orderBy = hasOrderBy ? '' : ' ORDER BY (SELECT NULL)';
    return `${baseSql}${orderBy} OFFSET ${offset} ROWS FETCH NEXT ${chunkLimit} ROWS ONLY`;
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
  protected async doBeginTransaction(): Promise<void> {
    if (!this.isConnected) await this.connect();
    if (this.inTransaction) throw new Error('Transaction already in progress');
    const mssql = safeRequireMssql();
    this.tx = new mssql.Transaction(this.pool!);
    await this.tx.begin();
    this.inTransaction = true;
    this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
  }

  /** Commit the current transaction. */
  protected async doCommitTransaction(): Promise<void> {
    if (!this.inTransaction || !this.tx) throw new Error('No transaction in progress');
    await this.tx.commit();
    this.tx = null;
    this.inTransaction = false;
    this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
  }

  /** Roll back the current transaction. */
  protected async doRollbackTransaction(): Promise<void> {
    if (!this.inTransaction || !this.tx) throw new Error('No transaction in progress');
    const tx = this.tx;
    this.tx = null;
    this.inTransaction = false;
    this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
    // MSSQL auto-aborts transactions on error; ignore rollback-of-aborted-tx errors.
    try {
      await tx.rollback();
    } catch {
      /* already aborted */
    }
  }

  /**
   * MSSQL savepoint support uses `SAVE TRANSACTION / ROLLBACK TRANSACTION` syntax.
   * MSSQL does not support `RELEASE SAVEPOINT`.
   */
  public override async createSavepoint(name: string): Promise<void> {
    await this.executeNonQuery(`SAVE TRANSACTION ${name}`);
  }

  public override async rollbackToSavepoint(name: string): Promise<void> {
    await this.executeNonQuery(`ROLLBACK TRANSACTION ${name}`);
  }

  // MSSQL has no RELEASE concept — this is intentionally a no-op
  public override async releaseSavepoint(_name: string): Promise<void> {}

  /** Enhanced transient error detection using SQL Server-specific error numbers. */
  protected override isTransientError(error: unknown): boolean {
    if (isMssqlTransientErrorNumber((error as { number?: number })?.number)) return true;
    return super.isTransientError(error);
  }

  /** Provide SQL dialect for this provider. */
  public getDialect(): SqlDialect {
    return new MssqlDialect();
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
    if (value === undefined) return null;
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value instanceof Date ||
      value instanceof Uint8Array
    ) {
      return value;
    }
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return String(value);
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
    return new UniqueConstraintError(message);
  }
  return new DatabaseError(message);
}
