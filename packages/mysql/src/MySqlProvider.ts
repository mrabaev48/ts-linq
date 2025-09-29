import type {
  EntityMetadata,
  ColumnMetadata,
  SqlLogger,
  RetryPolicy,
  OrmMiddleware,
  SoftDeleteOptions,
  SqlParameter,
  SqlDialect
} from '@ts-linq/core';
import {
  DatabaseProvider,
  OptimisticConcurrencyError,
  MetadataStorage,
  SqlHelper,
  UniqueConstraintError,
  DatabaseError
} from '@ts-linq/core';
import { MysqlDialect } from './MysqlDialect';
import { MySqlDdlStrategy } from './MySqlDdlStrategy';

/**
 * MySQL provider based on `mysql2/promise`.
 * Uses positional '?' placeholders and a pooled connection.
 *
 * @example
 * import 'reflect-metadata';
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

export class MySqlProvider extends DatabaseProvider {
  private pool: MySqlPoolLike | null = null;
  private ddl = new MySqlDdlStrategy();
  constructor(
    connectionString: string,
    logger?: SqlLogger,
    middlewares?: OrmMiddleware[],
    softDelete?: SoftDeleteOptions,
    retryPolicy?: RetryPolicy
  ) {
    super(connectionString, logger, middlewares, softDelete, retryPolicy);
    this.providerName = 'mysql';
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;
    const mysql = safeRequireMysql2();
    this.pool = mysql.createPool(this.connectionString);
    this.isConnected = true;
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.isConnected = false;
  }

  public async createTable(entity: EntityMetadata): Promise<void> {
    const sql = this.ddl.generateCreateTableSql(entity);
    await this.executeNonQuery(sql);
    for (const idx of entity.indexes) {
      await this.executeNonQuery(this.ddl.generateCreateIndexSql(entity.tableName, idx));
    }
  }

  public async insert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { sql, params } = this.generateInsertSql(entity as Record<string, unknown>, metadata);
    await this.executeNonQuery(sql, params);
    return entity;
  }

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
      if (versionCol) throw new OptimisticConcurrencyError();
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
  public async upsert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const insertable = metadata.columns.filter(
      (c) => !c.isGenerated || (entity as Record<string, unknown>)[c.propertyName] !== undefined
    );
    const names = insertable.map((c) => c.columnName);
    const placeholders = insertable.map(() => '?');
    const params: SqlParameter[] = insertable.map(
      (c) => (entity as Record<string, unknown>)[c.propertyName] as SqlParameter
    );
    const updatable = metadata.columns.filter(
      (c) => !metadata.primaryKeys.includes(c.propertyName) && !c.isGenerated
    );
    const updateSet = updatable.map((c) => `${c.columnName} = VALUES(${c.columnName})`).join(', ');
    const sql = `INSERT INTO ${metadata.tableName} (${names.join(', ')}) VALUES (${placeholders.join(', ')}) ON DUPLICATE KEY UPDATE ${updateSet}`;
    await this.executeNonQuery(sql, params);
    return entity;
  }

  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { sql, params } = this.generateDeleteSql(entity as Record<string, unknown>, metadata);
    const affectedRows = await this.executeNonQuery(sql, params);
    if (affectedRows === 0) throw new Error('No rows were deleted.');
  }

  public async findById<T extends object>(
    id: unknown,
    entityClass: new () => T
  ): Promise<T | null> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
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
    return rows.length ? this.mapRowToEntity(rows[0], entityClass) : null;
  }

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
    let sql2 = `SELECT * FROM ${metadata.tableName} WHERE ${columnName} IN (${placeholders})`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql2 += ` AND ${flag} = 0`;
    }
    const coerced: SqlParameter[] = values.map((v) => this.coerceToSqlParameter(v));
    const rows = await this.executeQuery<Record<string, unknown>>(sql2, coerced);
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

  public async beginTransaction(): Promise<void> {
    if (!this.isConnected) await this.connect();
    const pool = this.pool as MySqlPoolLike;
    await pool.query('START TRANSACTION');
    this.inTransaction = true;
    this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
  }
  public async commitTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    const pool = this.pool as MySqlPoolLike;
    await pool.query('COMMIT');
    this.inTransaction = false;
    this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
  }
  public async rollbackTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    const pool = this.pool as MySqlPoolLike;
    await pool.query('ROLLBACK');
    this.inTransaction = false;
    this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
  }

  /** Provide SQL dialect for this provider. */
  public getDialect(): SqlDialect {
    return new MysqlDialect();
  }

  /** Coerce arbitrary JS value into a valid SqlParameter for MySQL. */
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

  // DDL generation moved to MySqlDdlStrategy
  private generateInsertSql(
    entity: Record<string, unknown>,
    metadata: EntityMetadata
  ): { sql: string; params: SqlParameter[] } {
    const insertable = metadata.columns.filter(
      (c) => (!c.isGenerated || entity[c.propertyName] !== undefined) && !c.isComputed
    );
    const names = insertable.map((c) => c.columnName);
    const placeholders = insertable.map(() => '?');
    const params: SqlParameter[] = insertable.map((c) =>
      this.coerceToSqlParameter(entity[c.propertyName])
    );
    return {
      sql: `INSERT INTO ${metadata.tableName} (${names.join(', ')}) VALUES (${placeholders.join(', ')})`,
      params
    };
  }
  private generateUpdateSql(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata
  ): { sql: string; params: SqlParameter[] } {
    const updatable = metadata.columns.filter(
      (c) => !metadata.primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed
    );
    const setClauses: string[] = updatable.map((c) => `${c.columnName} = ?`);
    const setParams: SqlParameter[] = updatable.map((c) =>
      this.coerceToSqlParameter(entity[c.propertyName])
    );
    if (versionCol) setClauses.push(`${versionCol.columnName} = ${versionCol.columnName} + 1`);
    const whereClauses: string[] = [];
    const whereParams: SqlParameter[] = [];
    for (const pk of metadata.primaryKeys) {
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
}

function mapTypeToMySql(type: string): string {
  switch (type.toUpperCase()) {
    case 'TEXT':
    case 'STRING':
      return 'TEXT';
    case 'INTEGER':
    case 'NUMBER':
      return 'INT';
    case 'REAL':
    case 'FLOAT':
    case 'DOUBLE':
      return 'DOUBLE';
    case 'BOOLEAN':
      return 'TINYINT(1)';
    case 'DATETIME':
    case 'DATE':
      return 'DATETIME';
    case 'BLOB':
      return 'BLOB';
    default:
      return 'TEXT';
  }
}

function mapMySqlError(err: unknown): Error {
  const anyErr = err as { code?: string; message?: string } | undefined;
  const code = anyErr?.code;
  const message = anyErr?.message || String(err);
  if (code === 'ER_DUP_ENTRY') return new UniqueConstraintError(message, code);
  return new DatabaseError(message, code);
}

function safeRequireMysql2(): { createPool: (connectionString: string) => MySqlPoolLike } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('mysql2/promise');
  } catch (e) {
    throw new Error(
      'Package "mysql2" is required for MySqlProvider. Install it with: npm install mysql2'
    );
  }
}
