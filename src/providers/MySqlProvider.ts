import { DatabaseProvider } from './DatabaseProvider';
import {
  EntityMetadata,
  ColumnMetadata,
  SqlLogger,
  OptimisticConcurrencyError,
  RetryPolicy
} from '../types';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SqlHelper } from '../utils/SqlHelper';
import { SqlDialect } from '../query/SqlDialect';
import { MysqlDialect } from '../query/MysqlDialect';
import { MySqlDdlStrategy } from './mysql/MySqlDdlStrategy';

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
export class MySqlProvider extends DatabaseProvider {
  private pool: any | null = null;
  private ddl = new MySqlDdlStrategy();
  constructor(
    connectionString: string,
    logger?: SqlLogger,
    middlewares?: any[],
    softDelete?: any,
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

  public async insert<T>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { sql, params } = this.generateInsertSql(entity as any, metadata);
    await this.executeNonQuery(sql, params);
    return entity;
  }

  public async update<T>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const versionCol = metadata.columns.find((c) => (c as any).isVersion);
    const { sql, params } = this.generateUpdateSql(entity as any, metadata, versionCol as any);
    const n = await this.executeNonQuery(sql, params);
    if (n === 0) {
      if (versionCol) throw new OptimisticConcurrencyError();
      throw new Error('No rows were updated.');
    }
    if (versionCol)
      (entity as any)[(versionCol as any).propertyName] =
        ((entity as any)[(versionCol as any).propertyName] ?? 0) + 1;
    return entity;
  }

  /** Upsert using INSERT ... ON DUPLICATE KEY UPDATE ... */
  public async upsert<T>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const insertable = metadata.columns.filter(
      (c) => !c.isGenerated || (entity as any)[c.propertyName] !== undefined
    );
    const names = insertable.map((c) => c.columnName);
    const placeholders = insertable.map(() => '?');
    const params = insertable.map((c) => (entity as any)[c.propertyName]);
    const updatable = metadata.columns.filter(
      (c) => !metadata.primaryKeys.includes(c.propertyName) && !c.isGenerated
    );
    const updateSet = updatable.map((c) => `${c.columnName} = VALUES(${c.columnName})`).join(', ');
    const sql = `INSERT INTO ${metadata.tableName} (${names.join(', ')}) VALUES (${placeholders.join(', ')}) ON DUPLICATE KEY UPDATE ${updateSet}`;
    await this.executeNonQuery(sql, params);
    return entity;
  }

  public async delete<T>(entity: T, entityClass: Function): Promise<void> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { sql, params } = this.generateDeleteSql(entity as any, metadata);
    const n = await this.executeNonQuery(sql, params);
    if (n === 0) throw new Error('No rows were deleted.');
  }

  public async findById<T>(id: any, entityClass: new () => T): Promise<T | null> {
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
    const rows = await this.executeQuery<any>(sql, [id]);
    return rows.length ? this.mapRowToEntity(rows[0], entityClass) : null;
  }

  public async findAll<T>(entityClass: new () => T): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    let sql = `SELECT * FROM ${metadata.tableName}`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` WHERE ${flag} = 0`;
    }
    const rows = await this.executeQuery<any>(sql);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  public async findWhere<T>(entityClass: new () => T, conditions: any): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { whereClause, params } = SqlHelper.buildWhereClause(conditions);
    let sql = `SELECT * FROM ${metadata.tableName} WHERE ${whereClause}`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND ${flag} = 0`;
    }
    const rows = await this.executeQuery<any>(sql, params);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  public async findWhereIn<T>(
    entityClass: new () => T,
    column: string,
    values: any[]
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
    const rows = await this.executeQuery<any>(sql2, values);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  protected async doExecuteQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      if (!this.isConnected) await this.connect();
      const [rows] = await this.pool.query(sql, params);
      return rows as T[];
    } catch (e: any) {
      throw mapMySqlError(e);
    }
  }

  protected async doExecuteNonQuery(sql: string, params: any[] = []): Promise<number> {
    try {
      if (!this.isConnected) await this.connect();
      const [result]: any = await this.pool.execute(sql, params);
      return (result?.affectedRows ?? 0) as number;
    } catch (e: any) {
      throw mapMySqlError(e);
    }
  }

  public async beginTransaction(): Promise<void> {
    if (!this.isConnected) await this.connect();
    await this.pool.query('START TRANSACTION');
    this.inTransaction = true;
    this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
  }
  public async commitTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    await this.pool.query('COMMIT');
    this.inTransaction = false;
    this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
  }
  public async rollbackTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    await this.pool.query('ROLLBACK');
    this.inTransaction = false;
    this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
  }

  /** Provide SQL dialect for this provider. */
  public getDialect(): SqlDialect {
    return new MysqlDialect();
  }

  // DDL generation moved to MySqlDdlStrategy
  private generateInsertSql(entity: any, metadata: EntityMetadata): { sql: string; params: any[] } {
    const insertable = metadata.columns.filter(
      (c) => !c.isGenerated || entity[c.propertyName] !== undefined
    );
    const names = insertable.map((c) => c.columnName);
    const placeholders = insertable.map(() => '?');
    const params = insertable.map((c) => entity[c.propertyName]);
    return {
      sql: `INSERT INTO ${metadata.tableName} (${names.join(', ')}) VALUES (${placeholders.join(', ')})`,
      params
    };
  }
  private generateUpdateSql(
    entity: any,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata
  ): { sql: string; params: any[] } {
    const updatable = metadata.columns.filter(
      (c) => !metadata.primaryKeys.includes(c.propertyName) && !c.isGenerated
    );
    const setClauses: string[] = updatable.map((c) => `${c.columnName} = ?`);
    const setParams = updatable.map((c) => entity[c.propertyName]);
    if (versionCol) setClauses.push(`${versionCol.columnName} = ${versionCol.columnName} + 1`);
    const whereClauses: string[] = [];
    const whereParams: any[] = [];
    for (const pk of metadata.primaryKeys) {
      const col = metadata.columns.find((c) => c.propertyName === pk)!;
      whereClauses.push(`${col.columnName} = ?`);
      whereParams.push(entity[pk]);
    }
    if (versionCol) {
      whereClauses.push(`${versionCol.columnName} = ?`);
      whereParams.push(entity[(versionCol as any).propertyName]);
    }
    const sql = `UPDATE ${metadata.tableName} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    return { sql, params: [...setParams, ...whereParams] };
  }
  private generateDeleteSql(entity: any, metadata: EntityMetadata): { sql: string; params: any[] } {
    const whereClauses: string[] = [];
    const params: any[] = [];
    for (const pk of metadata.primaryKeys) {
      const col = metadata.columns.find((c) => c.propertyName === pk)!;
      whereClauses.push(`${col.columnName} = ?`);
      params.push(entity[pk]);
    }
    const sql = `DELETE FROM ${metadata.tableName} WHERE ${whereClauses.join(' AND ')}`;
    return { sql, params };
  }
  private mapRowToEntity<T>(row: any, entityClass: new () => T): T {
    const entity = new entityClass();
    const metadata = MetadataStorage.getEntity(entityClass);
    if (metadata) {
      for (const column of metadata.columns) {
        if (Object.prototype.hasOwnProperty.call(row, column.columnName)) {
          (entity as any)[column.propertyName] = row[column.columnName];
        }
      }
    } else {
      Object.assign(entity as any, row);
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

function mapMySqlError(err: any): Error {
  const code = err?.code;
  const message = err?.message || String(err);
  if (code === 'ER_DUP_ENTRY')
    return new (require('../types').UniqueConstraintError)(message, code);
  const DatabaseError = require('../types').DatabaseError;
  return new DatabaseError(message, code);
}

function safeRequireMysql2(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('mysql2/promise');
  } catch (e) {
    throw new Error(
      'Package "mysql2" is required for MySqlProvider. Install it with: npm install mysql2'
    );
  }
}
