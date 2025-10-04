import type {
  EntityMetadata,
  ColumnMetadata,
  RetryPolicy,
  SqlParameter,
  OrmMiddleware,
  SoftDeleteOptions,
  SqlLogger,
  SqlDialect
} from '@ts-linq/core';
import {
  DatabaseProvider,
  MetadataStorage,
  OptimisticConcurrencyError,
  SqlHelper
} from '@ts-linq/core';
import { SQLiteDialect, SQLiteDdlStrategy } from '@ts-linq/dialect-sqlite';
import type { SqliteDbLike } from '../sqlite/PoolAdapter';
import { createSqliteDb } from '../sqlite/PoolAdapter';
import { mapSqliteError } from '../sqlite/ErrorMapper';

export class SQLiteProvider extends DatabaseProvider {
  private db: SqliteDbLike | null = null;
  private ddl = new SQLiteDdlStrategy();

  constructor(
    connectionString: string,
    logger?: SqlLogger,
    middlewares?: OrmMiddleware[],
    softDelete?: SoftDeleteOptions,
    retryPolicy?: RetryPolicy
  ) {
    super(connectionString, logger, middlewares, softDelete, retryPolicy);
    this.providerName = 'sqlite';
  }

  public async connect(): Promise<void> {
    this.db = createSqliteDb(this.connectionString);
    // Enable foreign keys; ignore callback result
    this.db.run('PRAGMA foreign_keys = ON');
    this.isConnected = true;
    await Promise.resolve();
  }

  public async disconnect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (this.db) {
        this.db.close((err?: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      } else resolve();
    });
    this.db = null;
    this.isConnected = false;
  }

  public async createTable(entityMetadata: EntityMetadata): Promise<void> {
    const sql = this.ddl.generateCreateTableSql(entityMetadata);
    await this.executeNonQuery(sql);
    for (const index of entityMetadata.indexes) {
      const indexSql = this.ddl.generateCreateIndexSql(entityMetadata.tableName, index);
      await this.executeNonQuery(indexSql);
    }
  }

  public async insert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { sql, params } = this.generateInsertSql(entity as Record<string, unknown>, metadata);
    await this.executeNonQuery(sql, params);
    const primaryKey = metadata.primaryKeys[0];
    if (primaryKey) {
      const primaryKeyColumn = metadata.columns.find((c) => c.propertyName === primaryKey);
      if (primaryKeyColumn && primaryKeyColumn.isGenerated && this.mapTypeToSQLite(primaryKeyColumn.type) === 'INTEGER') {
        const rows = await this.executeQuery<{ id: number }>('SELECT last_insert_rowid() AS id');
        const id = rows && rows[0]?.id;
        if (id !== undefined) (entity as Record<string, unknown>)[primaryKey] = id as unknown as SqlParameter;
      }
    }
    return entity;
  }

  public async update<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const versionCol = metadata.columns.find((c) => c.isVersion);
    const { sql, params } = this.generateUpdateSql(entity as Record<string, unknown>, metadata, versionCol);
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

  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { sql, params } = this.generateDeleteSql(entity as Record<string, unknown>, metadata);
    const affectedRows = await this.executeNonQuery(sql, params);
    if (affectedRows === 0) throw new Error('No rows were deleted.');
  }

  public async findById<T extends object>(id: unknown, entityClass: new () => T): Promise<T | null> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const primaryKey = metadata.primaryKeys[0];
    const pkCol = metadata.columns.find((c) => c.propertyName === primaryKey);
    if (!pkCol) throw new Error(`Primary key column not found for ${entityClass.name}`);
    let sql = `SELECT * FROM ${metadata.tableName} WHERE ${pkCol.columnName} = ?`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND ${flag} = 0`;
    }
    const results = await this.executeQuery<Record<string, unknown>>(sql, [this.coerceToSqlParameter(id)]);
    return results.length > 0 ? this.mapRowToEntity<T>(results[0], entityClass) : null;
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
    const results = await this.executeQuery<Record<string, unknown>>(sql);
    return results.map((row) => this.mapRowToEntity<T>(row, entityClass));
  }

  public async findWhere<T extends object>(entityClass: new () => T, conditions: Record<string, unknown>): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { whereClause, params } = SqlHelper.buildWhereClause(conditions);
    let sql = `SELECT * FROM ${metadata.tableName} WHERE ${whereClause}`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND ${flag} = 0`;
    }
    const results = await this.executeQuery<Record<string, unknown>>(sql, params);
    return results.map((row) => this.mapRowToEntity<T>(row, entityClass));
  }

  public async findWhereIn<T extends object>(entityClass: new () => T, column: string, values: unknown[]): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    if (!Array.isArray(values) || values.length === 0) return [];
    const columnMeta = metadata.columns.find((c) => c.propertyName === column || c.columnName === column);
    const columnName = columnMeta ? columnMeta.columnName : column;
    const placeholders = values.map(() => '?').join(', ');
    let sql = `SELECT * FROM ${metadata.tableName} WHERE ${columnName} IN (${placeholders})`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND ${flag} = 0`;
    }
    const coerced: SqlParameter[] = values.map((v) => this.coerceToSqlParameter(v));
    const results = await this.executeQuery<Record<string, unknown>>(sql, coerced);
    return results.map((row) => this.mapRowToEntity<T>(row, entityClass));
  }

  protected async doExecuteQuery<T>(sql: string, params: readonly SqlParameter[] = []): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not connected'));
      this.db.all(sql, params as unknown as unknown[], (err: Error | null, rows: unknown[]) => {
        if (err) reject(mapSqliteError(err));
        else resolve(rows as T[]);
      });
    });
  }

  protected async doExecuteNonQuery(sql: string, params: readonly SqlParameter[] = []): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not connected'));
      this.db.run(sql, params as unknown as unknown[], function (this: { changes: number }, err: Error | null) {
        if (err) reject(mapSqliteError(err));
        else resolve(this.changes);
      });
    });
  }

  public async beginTransaction(): Promise<void> {
    if (this.inTransaction) throw new Error('Transaction already in progress');
    this.currentTraceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await this.executeNonQuery('BEGIN TRANSACTION');
    this.inTransaction = true;
    this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
  }
  public async commitTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    await this.executeNonQuery('COMMIT');
    this.inTransaction = false;
    const tid = this.currentTraceId; this.currentTraceId = undefined;
    this.logger?.transactionEnd?.({ traceId: tid, provider: this.providerName });
  }
  public async rollbackTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    await this.executeNonQuery('ROLLBACK');
    this.inTransaction = false;
    const tid = this.currentTraceId; this.currentTraceId = undefined;
    this.logger?.transactionEnd?.({ traceId: tid, provider: this.providerName });
  }

  public getDialect(): SqlDialect { return new SQLiteDialect(); }

  private generateInsertSql(
    entity: Record<string, unknown>,
    metadata: EntityMetadata
  ): { sql: string; params: SqlParameter[] } {
    const insertableColumns = metadata.columns.filter((col) => {
      const value = entity[col.propertyName];
      if (value !== undefined) return (!col.isGenerated || value !== null) && !col.isComputed;
      return false;
    });
    const columnNames = insertableColumns.map((col) => col.columnName);
    const placeholders = insertableColumns.map(() => '?');
    const params: SqlParameter[] = insertableColumns.map((col) => this.coerceToSqlParameter(entity[col.propertyName]));
    const sql = `INSERT INTO ${metadata.tableName} (${columnNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
    return { sql, params };
  }

  private generateUpdateSql(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata
  ): { sql: string; params: SqlParameter[] } {
    const updatableColumns = metadata.columns.filter((col) => !metadata.primaryKeys.includes(col.propertyName) && !col.isGenerated && !col.isComputed);
    if (updatableColumns.length === 0) throw new Error(`No updatable columns found for entity ${metadata.target.name}`);
    const setClauses: string[] = updatableColumns.map((col) => `${col.columnName} = ?`);
    const setParams: SqlParameter[] = updatableColumns.map((col) => this.coerceToSqlParameter(entity[col.propertyName]));
    if (versionCol) setClauses.push(`${versionCol.columnName} = ${versionCol.columnName} + 1`);
    const primaryKeyConditions: string[] = [];
    const whereParams: SqlParameter[] = [];
    for (const pkProperty of metadata.primaryKeys) {
      const pkColumn = metadata.columns.find((col) => col.propertyName === pkProperty);
      if (!pkColumn) throw new Error(`Primary key column ${pkProperty} not found for entity ${metadata.target.name}`);
      primaryKeyConditions.push(`${pkColumn.columnName} = ?`);
      whereParams.push(this.coerceToSqlParameter(entity[pkProperty]));
    }
    if (versionCol) {
      primaryKeyConditions.push(`${versionCol.columnName} = ?`);
      whereParams.push(this.coerceToSqlParameter(entity[versionCol.propertyName]));
    }
    const whereClause = primaryKeyConditions.join(' AND ');
    const sql = `UPDATE ${metadata.tableName} SET ${setClauses.join(', ')} WHERE ${whereClause}`;
    return { sql, params: [...setParams, ...whereParams] };
  }

  private generateDeleteSql(
    entity: Record<string, unknown>,
    metadata: EntityMetadata
  ): { sql: string; params: SqlParameter[] } {
    const primaryKeyConditions: string[] = [];
    const params: SqlParameter[] = [];
    for (const pkProperty of metadata.primaryKeys) {
      const pkColumn = metadata.columns.find((col) => col.propertyName === pkProperty);
      if (!pkColumn) throw new Error(`Primary key column ${pkProperty} not found for entity ${metadata.target.name}`);
      primaryKeyConditions.push(`${pkColumn.columnName} = ?`);
      params.push(this.coerceToSqlParameter(entity[pkProperty]));
    }
    const whereClause = primaryKeyConditions.join(' AND ');
    const sql = `DELETE FROM ${metadata.tableName} WHERE ${whereClause}`;
    return { sql, params };
  }

  private mapRowToEntity<T extends object>(row: unknown, entityClass: new () => T): T {
    const entity = new entityClass();
    const metadata = MetadataStorage.getEntity(entityClass);
    if (metadata) {
      for (const column of metadata.columns) {
        if (Object.prototype.hasOwnProperty.call(row as object, column.columnName)) {
          (entity as Record<string, unknown>)[column.propertyName] = this.convertValueFromDatabase((row as Record<string, unknown>)[column.columnName], column.type);
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
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date || value instanceof Uint8Array) {
      return value as SqlParameter;
    }
    try { return JSON.stringify(value ?? null) as unknown as SqlParameter; } catch { return String(value) as unknown as SqlParameter; }
  }

  private mapTypeToSQLite(type: string): string { return this.ddl.mapTypeToSQLite(type); }
  private convertValueFromDatabase(value: unknown, type: string): unknown {
    if (value === null || value === undefined) return value;
    switch (type.toUpperCase()) {
      case 'BOOLEAN': return Boolean(value);
      case 'INTEGER':
      case 'NUMBER': return Number(value as unknown as string);
      case 'DATETIME':
      case 'DATE': return new Date(value as unknown as string);
      case 'TEXT':
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) { try { return JSON.parse(value); } catch { return value; } }
        return value;
      default: return value;
    }
  }
}


