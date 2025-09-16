import * as sqlite3 from 'sqlite3';
import {
  DatabaseProvider,
  MetadataStorage,
  EntityMetadata,
  ColumnMetadata,
  RetryPolicy,
  SqlParameter,
  OrmMiddleware,
  SoftDeleteOptions,
  SqlLogger,
  DatabaseError,
  UniqueConstraintError,
  ForeignKeyConstraintError,
  OptimisticConcurrencyError,
  SqlHelper,
  SqlDialect
} from '@ts-linq/core';
import { SQLiteDialect } from './SQLiteDialect';
import { SQLiteDdlStrategy } from './SQLiteDdlStrategy';

/**
 * SQLite implementation of `DatabaseProvider` using the `sqlite3` package.
 * Handles connection lifecycle, DDL/DML generation and execution, and
 * simple value conversions between JS and SQLite.
 *
 * Note: sqlite3 driver is callback-based; provider wraps calls into Promises.
 */
export class SQLiteProvider extends DatabaseProvider {
  private db: sqlite3.Database | null = null;
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

  /** Open a connection to the SQLite database and enable foreign keys. */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.connectionString, (err) => {
        if (err) {
          reject(err);
        } else {
          this.isConnected = true;
          // Enable foreign key constraints
          this.db!.run('PRAGMA foreign_keys = ON');
          resolve();
        }
      });
    });
  }

  /** Close the SQLite database connection if open. */
  public async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.isConnected = false;
            this.db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /** Create a table from entity metadata and ensure indexes exist. */
  public async createTable(entityMetadata: EntityMetadata): Promise<void> {
    const sql = this.ddl.generateCreateTableSql(entityMetadata);
    await this.executeNonQuery(sql);

    // Create indexes
    for (const index of entityMetadata.indexes) {
      const indexSql = this.ddl.generateCreateIndexSql(entityMetadata.tableName, index);
      await this.executeNonQuery(indexSql);
    }
  }

  /** Insert the entity and set generated primary key when applicable. */
  public async insert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) {
      throw new Error(`Entity metadata not found for ${entityClass.name}`);
    }

    const { sql, params } = this.generateInsertSql(entity as Record<string, unknown>, metadata);
    await this.executeNonQuery(sql, params);
    // Handle generated PK via last_insert_rowid when applicable
    const primaryKey = metadata.primaryKeys[0];
    if (primaryKey) {
      const primaryKeyColumn = metadata.columns.find((c) => c.propertyName === primaryKey);
      if (
        primaryKeyColumn &&
        primaryKeyColumn.isGenerated &&
        this.mapTypeToSQLite(primaryKeyColumn.type) === 'INTEGER'
      ) {
        const rows = await this.executeQuery<{ id: number }>('SELECT last_insert_rowid() AS id');
        const id = rows && rows[0]?.id;
        if (id !== undefined) {
          (entity as Record<string, unknown>)[primaryKey] = id as unknown as SqlParameter;
        }
      }
    }
    return entity;
  }

  /** Update the entity row by primary key; supports optimistic concurrency via version column; throws if nothing affected. */
  public async update<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) {
      throw new Error(`Entity metadata not found for ${entityClass.name}`);
    }

    const versionCol = metadata.columns.find((c) => c.isVersion);
    const { sql, params } = this.generateUpdateSql(
      entity as Record<string, unknown>,
      metadata,
      versionCol
    );
    const affectedRows = await this.executeNonQuery(sql, params);

    if (affectedRows === 0) {
      if (versionCol) throw new OptimisticConcurrencyError();
      throw new Error(`No rows were updated. Entity may not exist or no changes detected.`);
    }

    // increment version in entity
    if (versionCol) {
      const prop = versionCol.propertyName;
      const rec = entity as Record<string, unknown>;
      const current = typeof rec[prop] === 'number' ? rec[prop] : Number(rec[prop] ?? 0);
      rec[prop] = current + 1;
    }
    return entity;
  }

  /** Delete the entity row by primary key; throws if nothing affected. */
  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) {
      throw new Error(`Entity metadata not found for ${entityClass.name}`);
    }

    const { sql, params } = this.generateDeleteSql(entity as Record<string, unknown>, metadata);
    const affectedRows = await this.executeNonQuery(sql, params);

    if (affectedRows === 0) {
      throw new Error(`No rows were deleted. Entity may not exist.`);
    }
  }

  /** Fetch a single entity by primary key value. */
  public async findById<T extends object>(
    id: unknown,
    entityClass: new () => T
  ): Promise<T | null> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) {
      throw new Error(`Entity metadata not found for ${entityClass.name}`);
    }

    const primaryKey = metadata.primaryKeys[0];
    if (!primaryKey) {
      throw new Error(`No primary key defined for ${entityClass.name}`);
    }

    const primaryKeyColumn = metadata.columns.find((c) => c.propertyName === primaryKey);
    if (!primaryKeyColumn) {
      throw new Error(`Primary key column not found for ${entityClass.name}`);
    }

    let sql = `SELECT * FROM ${metadata.tableName} WHERE ${primaryKeyColumn.columnName} = ?`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND ${flag} = 0`;
    }
    const results = await this.executeQuery<Record<string, unknown>>(sql, [
      this.coerceToSqlParameter(id)
    ]);

    return results.length > 0 ? this.mapRowToEntity<T>(results[0], entityClass) : null;
  }

  /** Fetch all rows for the given entity type. */
  public async findAll<T extends object>(entityClass: new () => T): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) {
      throw new Error(`Entity metadata not found for ${entityClass.name}`);
    }

    let sql = `SELECT * FROM ${metadata.tableName}`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` WHERE ${flag} = 0`;
    }
    const results = await this.executeQuery<Record<string, unknown>>(sql);

    return results.map((row) => this.mapRowToEntity<T>(row, entityClass));
  }

  /** Fetch rows that match a simple conditions object. */
  public async findWhere<T extends object>(
    entityClass: new () => T,
    conditions: Record<string, unknown>
  ): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) {
      throw new Error(`Entity metadata not found for ${entityClass.name}`);
    }

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

  /** Fetch rows where a single column value is within a list (IN clause). */
  public async findWhereIn<T extends object>(
    entityClass: new () => T,
    column: string,
    values: unknown[]
  ): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) {
      throw new Error(`Entity metadata not found for ${entityClass.name}`);
    }

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
    const results = await this.executeQuery<Record<string, unknown>>(sql, coerced);
    return results.map((row) => this.mapRowToEntity<T>(row, entityClass));
  }

  /** Execute a query and return raw rows. */
  protected async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.all(sql, params as unknown as unknown[], (err, rows) => {
        if (err) {
          reject(mapSqliteError(err));
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  /** Execute a non-query statement and return affected rows count. */
  protected async doExecuteNonQuery(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.run(sql, params as unknown as unknown[], function (err) {
        if (err) {
          reject(mapSqliteError(err));
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /** Begin a SQLite transaction. */
  public async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error('Transaction already in progress');
    }
    this.currentTraceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await this.executeNonQuery('BEGIN TRANSACTION');
    this.inTransaction = true;
    this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
  }

  /** Commit the current SQLite transaction. */
  public async commitTransaction(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    await this.executeNonQuery('COMMIT');
    this.inTransaction = false;
    const tid = this.currentTraceId;
    this.currentTraceId = undefined;
    this.logger?.transactionEnd?.({ traceId: tid, provider: this.providerName });
  }

  /** Roll back the current SQLite transaction. */
  public async rollbackTransaction(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    await this.executeNonQuery('ROLLBACK');
    this.inTransaction = false;
    const tid = this.currentTraceId;
    this.currentTraceId = undefined;
    this.logger?.transactionEnd?.({ traceId: tid, provider: this.providerName });
  }

  /** Provide SQL dialect for this provider. */
  public getDialect(): SqlDialect {
    return new SQLiteDialect();
  }

  /** Generate INSERT SQL and parameter list for the given entity. */
  private generateInsertSql(
    entity: Record<string, unknown>,
    metadata: EntityMetadata
  ): { sql: string; params: SqlParameter[] } {
    const insertableColumns = metadata.columns.filter((col) => {
      // Exclude columns without provided value to allow DB defaults
      const value = entity[col.propertyName];
      // include when value is defined (can be null intentionally)
      if (value !== undefined) return !col.isGenerated || value !== null;
      return false;
    });

    const columnNames = insertableColumns.map((col) => col.columnName);
    const placeholders = insertableColumns.map(() => '?');
    const params: SqlParameter[] = insertableColumns.map((col) =>
      this.coerceToSqlParameter(entity[col.propertyName])
    );

    const sql = `INSERT INTO ${metadata.tableName} (${columnNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
    return { sql, params };
  }

  /** Generate UPDATE SQL and params based on non-PK columns and PK WHERE clause. */
  private generateUpdateSql(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata
  ): { sql: string; params: SqlParameter[] } {
    const updatableColumns = metadata.columns.filter(
      (col) => !metadata.primaryKeys.includes(col.propertyName) && !col.isGenerated
    );

    if (updatableColumns.length === 0) {
      throw new Error(`No updatable columns found for entity ${metadata.target.name}`);
    }

    const setClauses: string[] = updatableColumns.map((col) => `${col.columnName} = ?`);
    const setParams: SqlParameter[] = updatableColumns.map((col) =>
      this.coerceToSqlParameter(entity[col.propertyName])
    );
    if (versionCol) {
      setClauses.push(`${versionCol.columnName} = ${versionCol.columnName} + 1`);
    }

    const primaryKeyConditions: string[] = [];
    const whereParams: SqlParameter[] = [];

    for (const pkProperty of metadata.primaryKeys) {
      const pkColumn = metadata.columns.find((col) => col.propertyName === pkProperty);
      if (!pkColumn) {
        throw new Error(
          `Primary key column ${pkProperty} not found for entity ${metadata.target.name}`
        );
      }
      primaryKeyConditions.push(`${pkColumn.columnName} = ?`);
      whereParams.push(this.coerceToSqlParameter(entity[pkProperty]));
    }

    if (versionCol) {
      primaryKeyConditions.push(`${versionCol.columnName} = ?`);
      whereParams.push(this.coerceToSqlParameter(entity[versionCol.propertyName]));
    }

    if (primaryKeyConditions.length === 0) {
      throw new Error(`No primary key values found for entity ${metadata.target.name}`);
    }

    const whereClause = primaryKeyConditions.join(' AND ');
    const sql = `UPDATE ${metadata.tableName} SET ${setClauses.join(', ')} WHERE ${whereClause}`;
    return { sql, params: [...setParams, ...whereParams] };
  }

  /** Generate DELETE SQL and params using primary key values. */
  private generateDeleteSql(
    entity: Record<string, unknown>,
    metadata: EntityMetadata
  ): { sql: string; params: SqlParameter[] } {
    const primaryKeyConditions: string[] = [];
    const params: SqlParameter[] = [];

    for (const pkProperty of metadata.primaryKeys) {
      const pkColumn = metadata.columns.find((col) => col.propertyName === pkProperty);
      if (!pkColumn) {
        throw new Error(
          `Primary key column ${pkProperty} not found for entity ${metadata.target.name}`
        );
      }
      primaryKeyConditions.push(`${pkColumn.columnName} = ?`);
      params.push(this.coerceToSqlParameter(entity[pkProperty]));
    }

    if (primaryKeyConditions.length === 0) {
      throw new Error(`No primary key values found for entity ${metadata.target.name}`);
    }

    const whereClause = primaryKeyConditions.join(' AND ');
    const sql = `DELETE FROM ${metadata.tableName} WHERE ${whereClause}`;

    return { sql, params };
  }

  /** Map a generic type string to an SQLite column type. */
  private mapTypeToSQLite(type: string): string {
    return this.ddl.mapTypeToSQLite(type);
  }

  /** Map a database row object to a new entity instance using metadata. */
  private mapRowToEntity<T extends object>(row: unknown, entityClass: new () => T): T {
    const entity = new entityClass();
    const metadata = MetadataStorage.getEntity(entityClass);

    if (metadata) {
      for (const column of metadata.columns) {
        if (Object.prototype.hasOwnProperty.call(row as object, column.columnName)) {
          (entity as Record<string, unknown>)[column.propertyName] = this.convertValueFromDatabase(
            (row as Record<string, unknown>)[column.columnName],
            column.type
          );
        }
      }
    } else {
      // Fallback: copy all properties
      Object.assign(entity as object, row as object);
    }
    // notify middleware
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.notifyEntityMaterialized(entity, metadata);
    return entity;
  }

  /** Coerce arbitrary value into SQL parameter type accepted by SQLite. */
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

  /** Convert a JS value to a DB-storable value according to type. */
  private convertValueForDatabase(value: unknown, type: string): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    switch (type.toUpperCase()) {
      case 'BOOLEAN':
        return (value as boolean) ? 1 : 0;
      case 'DATETIME':
      case 'DATE':
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      case 'TEXT':
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
      default:
        return value;
    }
  }

  /** Convert a DB value to a JS runtime value according to type. */
  private convertValueFromDatabase(value: unknown, type: string): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    switch (type.toUpperCase()) {
      case 'BOOLEAN':
        return Boolean(value);
      case 'INTEGER':
      case 'NUMBER':
        return Number(value as unknown as string);
      case 'DATETIME':
      case 'DATE':
        return new Date(value as unknown as string);
      case 'TEXT':
        // Try to parse as JSON if it looks like JSON
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return value;
      default:
        return value;
    }
  }
}

/** Map sqlite3 error to typed DatabaseError. */
function mapSqliteError(err: unknown): Error {
  const anyErr = err as { code?: string; message?: string } | undefined;
  const code = anyErr?.code;
  const message = anyErr?.message || String(err);
  if (!code) return new DatabaseError(message);
  // sqlite codes: https://www.sqlite.org/rescode.html (library-dependent)
  // Prefer FK if message indicates it
  if (message && message.toLowerCase().includes('foreign key')) {
    return new ForeignKeyConstraintError(message, code);
  }
  if (code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new UniqueConstraintError(message, code);
  }
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || code === 'SQLITE_CONSTRAINT_TRIGGER') {
    return new ForeignKeyConstraintError(message, code);
  }
  return new DatabaseError(message, code);
}
