import { DatabaseProvider, ProviderConfig, SqlHelper } from '@ts-linq/core';
import { MySqlDdlStrategy, MysqlDialect } from '@ts-linq/dialect-mysql';
import { MetadataStorage } from '@ts-linq/metadata';
import type {
  EntityCtorRef,
  EntityMetadata,
  MySqlConfig,
  SqlDialect,
  SqlParameter
} from '@ts-linq/types';
import {
  DatabaseError,
  ForeignKeyConstraintError,
  OptimisticConcurrencyError,
  ParameterCoercionError,
  requireCrud,
  UniqueConstraintError
} from '@ts-linq/types';

import { buildMysqlConnectionString } from './buildConnectionString';
import { encodeWkb, isGeometryObject } from './spatial-codec';
import { MySqlSequenceStrategy } from './strategies/MySqlSequenceStrategy';
import { isMysqlTransientErrorCode } from './transientErrorCodes';

/**
 * MySQL provider based on `mysql2/promise`.
 * Uses positional '?' placeholders and a pooled connection.
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
 *   constructor() { super({ provider: 'mysql', connectionString: process.env.MYSQL_URL! }); }
 * }
 *
 * async function run() {
 *   const ctx = new AppCtx();
 *   await ctx.ensureCreated();
 *   const user = new User(); user.name = 'Bob';
 *   ctx.users.add(user);
 *   await ctx.saveChanges();
 *   const all = await ctx.users.toArray();
 *   await ctx.dispose();
 * }
 */
interface MySqlPoolLike {
  query(sql: string, params?: readonly SqlParameter[]): Promise<[unknown]>;
  execute(sql: string, params?: readonly SqlParameter[]): Promise<[unknown]>;
  end(): Promise<void>;
}

function mapMySqlError(err: unknown): Error {
  const anyErr = err as { code?: string; message?: string } | undefined;
  const code = anyErr?.code;
  const message = anyErr?.message || String(err);
  if (code === 'ER_DUP_ENTRY') return new UniqueConstraintError(message, code);
  if (code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_ROW_IS_REFERENCED_2')
    return new ForeignKeyConstraintError(message, code);
  return new DatabaseError(message ?? 'Unknown error');
}

function safeRequireMysql2(): { createPool: (connectionString: string) => MySqlPoolLike } {
  try {
    return require('mysql2/promise');
  } catch (e) {
    throw new Error(
      'Package "mysql2" is required for MySqlProvider. Install it with: npm install mysql2'
    );
  }
}

export class MySqlProvider extends DatabaseProvider {
  private pool: MySqlPoolLike | null = null;
  private ddl = new MySqlDdlStrategy();
  private readonly config: MySqlConfig;
  private ownsPool = true;

  constructor(config: MySqlConfig) {
    const connectionString = buildMysqlConnectionString(config);
    super(
      new ProviderConfig({
        providerName: 'mysql',
        connectionString,
        logger: config.logger,
        middlewares: config.middlewares,
        softDelete: config.softDelete,
        retryPolicy: config.retryPolicy,
        poolOptions: config.poolOptions,
        healthCheck: config.healthCheck,
        sequenceStrategy: new MySqlSequenceStrategy()
      })
    );
    this.config = config;
  }

  protected async doConnect(): Promise<void> {
    if (this.isConnected) return;

    if (this.config.pool) {
      this.pool = this.config.pool as MySqlPoolLike;
      this.ownsPool = false;
    } else {
      const mysql = safeRequireMysql2();
      const opts = this.poolOptions || {};
      // Map generic pool options to mysql2 pool options when available
      const mysqlConfig: Record<string, unknown> = { uri: this.connectionString };
      if (typeof opts.max === 'number') mysqlConfig.connectionLimit = opts.max;
      if (typeof opts.acquireTimeoutMs === 'number')
        mysqlConfig.acquireTimeout = opts.acquireTimeoutMs;
      if (typeof opts.connectionTimeoutMs === 'number')
        mysqlConfig.connectTimeout = opts.connectionTimeoutMs;
      // Note: mysql2 uses waitForConnections/queueLimit; idle timeout is managed by server or 'idleTimeout' in some forks
      this.pool = (
        mysql as unknown as { createPool: (config: unknown) => MySqlPoolLike }
      ).createPool(mysqlConfig);
      this.ownsPool = true;
    }

    this.isConnected = true;
    // Health checks
    await (async () => {
      // ensure at least one awaited async in connect() for lint rule
      /* noop */
    })();
    this.startHealthChecks(async () => {
      const started = Date.now();
      const pool = this.pool as MySqlPoolLike;
      const sql = 'SELECT 1';
      await pool.query(sql);
      return Date.now() - started;
    });
  }

  protected async doDisconnect(): Promise<void> {
    this.stopHealthChecks();
    if (this.pool && this.ownsPool) {
      await this.pool.end();
      this.pool = null;
    }
    this.isConnected = false;
  }

  public async createTable(entity: EntityMetadata): Promise<void> {
    const sql = this.ddl.generateCreateTableSql(entity);
    await this.executeNonQuery(sql);
    for (const idx of entity.indexes) {
      await this.executeNonQuery(
        this.ddl.generateCreateIndexSql(entity.tableName, {
          ...idx,
          unique: idx.unique ?? false
        })
      );
    }
  }

  public async insert<T extends object>(entity: T, entityClass: EntityCtorRef): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const dialect = this.getDialect();
    requireCrud(dialect);
    const { sql, parameters } = dialect.buildInsert(entity as Record<string, unknown>, metadata);
    const insertId = await this.executeInsert(sql, parameters);
    const genPkProp = this.findGeneratedPkProperty(metadata);
    if (genPkProp && insertId) {
      (entity as Record<string, unknown>)[genPkProp] = insertId;
    }
    return entity;
  }

  private async executeInsert(
    sql: string,
    params: readonly SqlParameter[]
  ): Promise<number | undefined> {
    try {
      if (!this.isConnected) await this.connect();
      await this.beforeExecute(sql, params);
      const pool = this.pool as MySqlPoolLike;
      const [result] = await pool.execute(sql, params);
      const insertResult = result as { insertId?: number; affectedRows?: number } | undefined;
      const affectedRows = insertResult?.affectedRows ?? 1;
      await this.afterExecute(sql, params, affectedRows);
      return insertResult?.insertId ?? undefined;
    } catch (e: unknown) {
      throw mapMySqlError(e);
    }
  }

  private findGeneratedPkProperty(metadata: EntityMetadata): string | undefined {
    if (!metadata.primaryKeys?.length) return undefined;
    const pk = metadata.primaryKeys[0];
    const col = metadata.columns.find((c) => c.propertyName === pk);
    return col?.isGenerated ? pk : undefined;
  }

  public async update<T extends object>(
    entity: T,
    entityClass: EntityCtorRef,
    originalValues?: object
  ): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const versionCol = metadata.columns.find((c) => c.isVersion);
    const concurrencyTokens = metadata.columns.filter((c) => c.isConcurrencyToken && !c.isVersion);
    const dialect = this.getDialect();
    requireCrud(dialect);
    const { sql, parameters } = dialect.buildUpdate(
      entity as Record<string, unknown>,
      metadata,
      versionCol,
      concurrencyTokens,
      originalValues as Record<string, unknown> | undefined
    );
    const affectedRows = await this.executeNonQuery(sql, parameters);
    if (affectedRows === 0) {
      if (versionCol || concurrencyTokens.length > 0)
        throw new OptimisticConcurrencyError('Version mismatch detected during update');
      throw new Error('No rows were updated.');
    }
    if (versionCol) {
      const prop = versionCol.propertyName;
      const rec = entity as Record<string, unknown>;
      const current = typeof rec[prop] === 'number' ? rec[prop] : Number(rec[prop] ?? 0);
      rec[prop] = current + 1;
    }
    return entity;
  }

  /** Upsert using INSERT ... ON DUPLICATE KEY UPDATE ... */
  public async upsert<T extends object>(entity: T, entityClass: EntityCtorRef): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      return this.insert(entity, entityClass);
    }
    const primaryKeys = metadata.primaryKeys;
    const insertable = metadata.columns.filter(
      (c) => !c.isGenerated || (entity as Record<string, unknown>)[c.propertyName] !== undefined
    );
    const names = insertable.map((c) => c.columnName);
    const placeholders = insertable.map(() => '?');
    const params: SqlParameter[] = insertable.map(
      (c) => (entity as Record<string, unknown>)[c.propertyName] as SqlParameter
    );
    const updatable = metadata.columns.filter(
      (c) => !primaryKeys.includes(c.propertyName) && !c.isGenerated
    );
    const updateSet = updatable.map((c) => `${c.columnName} = VALUES(${c.columnName})`).join(', ');
    const sql = `INSERT INTO ${metadata.tableName} (${names.join(', ')}) VALUES (${placeholders.join(', ')}) ON DUPLICATE KEY UPDATE ${updateSet}`;
    await this.executeNonQuery(sql, params);
    return entity;
  }

  public async delete<T extends object>(
    entity: T,
    entityClass: EntityCtorRef,
    originalValues?: object
  ): Promise<void> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const concurrencyTokens = metadata.columns.filter((c) => c.isConcurrencyToken);
    const dialect = this.getDialect();
    requireCrud(dialect);
    const { sql, parameters } = dialect.buildDelete(
      entity as Record<string, unknown>,
      metadata,
      concurrencyTokens,
      originalValues as Record<string, unknown> | undefined
    );
    const affectedRows = await this.executeNonQuery(sql, parameters);
    if (affectedRows === 0) {
      if (concurrencyTokens.length > 0)
        throw new OptimisticConcurrencyError('Version mismatch detected during delete');
      throw new Error('No rows were deleted.');
    }
  }

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
        parameters: [this.coerceToSqlParameter(id, pk)]
      }
    ];

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where, limit: 1 }, metadata);
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);
    return rows.length ? this.mapRowToEntity(rows[0], entityClass) : null;
  }

  public async findAll<T extends object>(entityClass: new () => T): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);

    const where: import('@ts-linq/types').WhereClause[] = [];

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where }, metadata);
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  public async findWhere<T extends object>(
    entityClass: new () => T,
    conditions: Record<string, unknown>
  ): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);

    // Note: SqlHelper.buildWhereClause produces a string like "col1 = ? AND col2 = ?"
    // We wrap it in a single WhereClause
    const { whereClause, params } = SqlHelper.buildWhereClause(conditions);

    const where: import('@ts-linq/types').WhereClause[] = [];
    if (whereClause) {
      where.push({
        condition: whereClause,
        parameters: params
      });
    }

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where }, metadata);
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  public async findWhereIn<T extends object>(
    entityClass: new () => T,
    column: string,
    values: unknown[]
  ): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    if (!values?.length) return [];

    const columnMeta = metadata.columns.find(
      (c) => c.propertyName === column || c.columnName === column
    );
    const columnName = columnMeta ? columnMeta.columnName : column;
    const placeholders = values.map(() => '?').join(', ');
    const coerced = values.map((v) => this.coerceToSqlParameter(v, column));

    const where: import('@ts-linq/types').WhereClause[] = [
      {
        condition: `${this.getDialect().quoteIdentifier(columnName)} IN (${placeholders})`,
        parameters: coerced
      }
    ];

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where }, metadata);
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  protected async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    try {
      if (!this.isConnected) await this.connect();
      const pool = this.pool as MySqlPoolLike;
      const [rows] = await pool.query(sql, params);
      return rows as T[];
    } catch (e: unknown) {
      throw mapMySqlError(e);
    }
  }

  protected async doExecuteNonQuery(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<number> {
    try {
      if (!this.isConnected) await this.connect();
      const pool = this.pool as MySqlPoolLike;
      const [result] = await pool.execute(sql, params);
      const affected = (result as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
      return affected;
    } catch (e: unknown) {
      throw mapMySqlError(e);
    }
  }

  /** Obtain MySQL EXPLAIN plan (JSON where supported) */
  protected async getExplainPlan(
    sql: string,
    params: readonly SqlParameter[]
  ): Promise<unknown | undefined> {
    try {
      // Prefer EXPLAIN FORMAT=JSON for MySQL 5.7+/8.0+, fallback to plain EXPLAIN
      const explainJson = `EXPLAIN FORMAT=JSON ${sql}`;
      try {
        const rows = await this.doExecuteQuery<Record<string, unknown>>(explainJson, params);
        const first = rows && rows[0];
        if (first) return first;
      } catch {
        /* fall back */
      }
      const rows = await this.doExecuteQuery<Record<string, unknown>>(`EXPLAIN ${sql}`, params);
      return rows;
    } catch {
      return undefined;
    }
  }

  protected async doBeginTransaction(): Promise<void> {
    if (!this.isConnected) await this.connect();
    const pool = this.pool as MySqlPoolLike;
    await pool.query('START TRANSACTION');
    this.inTransaction = true;
    this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
  }
  protected async doCommitTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    const pool = this.pool as MySqlPoolLike;
    await pool.query('COMMIT');
    this.inTransaction = false;
    this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
  }
  protected async doRollbackTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    const pool = this.pool as MySqlPoolLike;
    await pool.query('ROLLBACK');
    this.inTransaction = false;
    this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
  }

  // mysql2 pool.execute() uses prepared statements which do not support SAVEPOINT syntax;
  // transaction-control statements (ANSI SQL from the savepoint strategy) must go through
  // pool.query() instead. Only the execution route differs — the SQL is the ANSI default.
  protected override async runSavepointStatement(sql: string): Promise<void> {
    if (!this.isConnected) await this.connect();
    const pool = this.pool as MySqlPoolLike;
    await pool.query(sql);
  }

  /** Enhanced transient error detection using MySQL-specific error codes. */
  protected override isTransientError(error: unknown): boolean {
    if (isMysqlTransientErrorCode((error as { errno?: number })?.errno)) return true;
    return super.isTransientError(error);
  }

  /** Provide SQL dialect for this provider. */
  public getDialect(): SqlDialect {
    return new MysqlDialect();
  }

  /** Coerce arbitrary JS value into a valid SqlParameter for MySQL. */
  private coerceToSqlParameter(value: unknown, property?: string): SqlParameter {
    if (isGeometryObject(value)) {
      return encodeWkb(value);
    }
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
    // `bigint` is not JSON-serializable; render it as decimal text (preserves prior behavior).
    if (typeof value === 'bigint') {
      return value.toString();
    }
    // A non-serializable value (e.g. a circular reference) fails fast instead of silently binding a
    // corrupt `"[object Object]"` parameter.
    try {
      return JSON.stringify(value ?? null);
    } catch (cause) {
      throw new ParameterCoercionError(
        `Failed to coerce parameter${property ? ` for property '${property}'` : ''} to a driver-safe value`,
        { cause, details: { property } }
      );
    }
  }

  private mapRowToEntity<T extends object>(row: unknown, entityClass: new () => T): T {
    const entity = new entityClass();
    const metadata = MetadataStorage.getEntity(entityClass);
    if (metadata) {
      for (const column of metadata.columns) {
        if (Object.prototype.hasOwnProperty.call(row as object, column.columnName)) {
          const rawVal = (row as Record<string, unknown>)[column.columnName];
          (entity as Record<string, unknown>)[column.propertyName] = column.converter
            ? column.converter.fromProvider(rawVal)
            : rawVal;
        }
      }
    } else {
      Object.assign(entity as object, row as object);
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.notifyEntityMaterialized(entity, metadata);
    return entity;
  }
}
