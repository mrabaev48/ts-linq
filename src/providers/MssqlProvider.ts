import { DatabaseProvider } from './DatabaseProvider';
import { EntityMetadata, ColumnMetadata, SqlLogger, OptimisticConcurrencyError } from '../types';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SqlHelper } from '../utils/SqlHelper';

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
  private pool: any | null = null;
  private tx: any | null = null;
  /** Create provider with MSSQL connection string. */
  constructor(connectionString: string, logger?: SqlLogger, middlewares?: any[], softDelete?: any) {
    super(connectionString, logger, middlewares, softDelete);
    this.providerName = 'mssql';
  }

  /** Open a connection pool to MSSQL server. */
  public async connect(): Promise<void> {
    if (this.isConnected) return;
    const mssql = safeRequireMssql();
    this.pool = new mssql.ConnectionPool(this.connectionString);
    await this.pool.connect();
    this.isConnected = true;
  }

  /** Close transaction (if any) and dispose the pool. */
  public async disconnect(): Promise<void> {
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
    const sql = this.generateCreateTableSql(entityMetadata);
    await this.executeNonQuery(sql);
    // Indexes
    for (const index of entityMetadata.indexes) {
      const idxSql = this.generateCreateIndexSql(entityMetadata.tableName, index);
      await this.executeNonQuery(idxSql);
    }
  }

  /** Insert entity row; when PK is IDENTITY, sets generated value via SCOPE_IDENTITY(). */
  public async insert<T>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);

    const { sql, params, returningPk } = this.generateInsertSql(entity, metadata);
    // For MSSQL, to retrieve identity we need a separate SELECT SCOPE_IDENTITY() or OUTPUT clause.
    const affected = await this.executeNonQuery(sql, params);
    if (affected > 0 && returningPk) {
      const rows = await this.executeQuery<{ id: number }>(
        'SELECT CAST(SCOPE_IDENTITY() AS INT) AS id'
      );
      const id = rows && rows[0]?.id;
      if (id !== undefined) {
        (entity as any)[returningPk] = id;
      }
    }
    return entity;
  }

  /** Update entity row by primary key. Throws if no rows affected. */
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

  /** Delete entity row by primary key. Throws if no rows affected. */
  public async delete<T>(entity: T, entityClass: Function): Promise<void> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { sql, params } = this.generateDeleteSql(entity as any, metadata);
    const n = await this.executeNonQuery(sql, params);
    if (n === 0) throw new Error('No rows were deleted.');
  }

  /** Upsert using MERGE statement (simplified). */
  public async upsert<T>(entity: T, entityClass: Function): Promise<T> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const pk = metadata.primaryKeys;
    if (!pk.length) return this.insert(entity, entityClass);

    const updatable = metadata.columns.filter(
      (c) => !metadata.primaryKeys.includes(c.propertyName) && !c.isGenerated
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
    const params = sourceCols.map((c) => (entity as any)[c.propertyName]);

    const sql =
      `MERGE ${metadata.tableName} AS t USING (SELECT ${sourceSelect}) AS s ON (${onClause}) ` +
      (setClause ? `WHEN MATCHED THEN UPDATE SET ${setClause} ` : '') +
      `WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals});`;
    await this.executeNonQuery(sql, params);
    return entity;
  }

  /** Find a single entity by its primary key value. */
  public async findById<T>(id: any, entityClass: new () => T): Promise<T | null> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const pk = metadata.primaryKeys[0];
    if (!pk) throw new Error(`No primary key defined for ${entityClass.name}`);
    const pkCol = metadata.columns.find((c) => c.propertyName === pk)!;
    let sql = `SELECT * FROM ${metadata.tableName} WHERE ${pkCol.columnName} = ?`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND ${flag} = 0`;
    }
    const rows = await this.executeQuery<any>(sql, [id]);
    if (rows.length === 0) return null;
    return this.mapRowToEntity(rows[0], entityClass);
  }

  /** Return all entities of the given type. */
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

  /** Find entities by simple conditions object (column equals). */
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

  /** Find entities where a column value is in the given array (IN clause). */
  public async findWhereIn<T>(
    entityClass: new () => T,
    column: string,
    values: any[]
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
    const rows = await this.executeQuery<any>(sql, values);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  /** Execute a SQL query and return the recordset rows. */
  protected async doExecuteQuery<T>(_sql: string, _params?: any[]): Promise<T[]> {
    if (!this.isConnected) await this.connect();
    const mssql = safeRequireMssql();
    const { sql, params } = prepareMssqlSql(_sql, _params || []);
    const request = new mssql.Request(this.tx || this.pool);
    params.forEach((value, i) => request.input(`p${i + 1}`, value));
    try {
      const result = await request.query(sql);
      return (result.recordset || []) as T[];
    } catch (e: any) {
      throw mapMssqlError(e);
    }
  }

  /** Execute a non-query SQL statement and return affected rows count. */
  protected async doExecuteNonQuery(_sql: string, _params?: any[]): Promise<number> {
    if (!this.isConnected) await this.connect();
    const mssql = safeRequireMssql();
    const { sql, params } = prepareMssqlSql(_sql, _params || []);
    const request = new mssql.Request(this.tx || this.pool);
    params.forEach((value, i) => request.input(`p${i + 1}`, value));
    try {
      const result = await request.query(sql);
      const rowsAffected: number[] = result.rowsAffected || [];
      return rowsAffected.reduce((sum, n) => sum + (n || 0), 0);
    } catch (e: any) {
      throw mapMssqlError(e);
    }
  }

  /** Begin a database transaction. */
  public async beginTransaction(): Promise<void> {
    if (!this.isConnected) await this.connect();
    if (this.inTransaction) throw new Error('Transaction already in progress');
    const mssql = safeRequireMssql();
    this.tx = new mssql.Transaction(this.pool);
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

  // Private helpers
  private generateCreateTableSql(metadata: EntityMetadata): string {
    if (!metadata || !metadata.columns) {
      throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
    }
    const columns: string[] = metadata.columns.map((c: ColumnMetadata) =>
      this.generateColumnDefinition(c)
    );
    if (metadata.primaryKeys.length > 0) {
      const pkCols = metadata.primaryKeys.map((pk) => {
        const col = metadata.columns.find((c) => c.propertyName === pk);
        return col ? col.columnName : pk;
      });
      columns.push(`PRIMARY KEY (${pkCols.join(', ')})`);
    }
    return `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '${metadata.tableName}') BEGIN CREATE TABLE ${metadata.tableName} (${columns.join(', ')}) END`;
  }

  private generateColumnDefinition(column: ColumnMetadata): string {
    let definition = `${column.columnName} ${mapTypeToMssql(column.type)}`;
    if (column.length) {
      definition += `(${column.length})`;
    }
    if (!column.nullable) {
      definition += ' NOT NULL';
    }
    if (column.defaultValue !== undefined) {
      definition += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
    }
    return definition;
  }

  private generateCreateIndexSql(
    tableName: string,
    index: { name: string; columns: string[]; unique: boolean }
  ): string {
    const unique = index.unique ? 'UNIQUE ' : '';
    return `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${index.name}' AND object_id=OBJECT_ID('${tableName}')) CREATE ${unique}INDEX ${index.name} ON ${tableName} (${index.columns.join(', ')})`;
  }

  private generateInsertSql(
    entity: any,
    metadata: EntityMetadata
  ): { sql: string; params: any[]; returningPk?: string } {
    const insertable = metadata.columns.filter(
      (col) => !col.isGenerated || entity[col.propertyName] !== undefined
    );
    const columnNames = insertable.map((c) => c.columnName);
    const placeholders = insertable.map(() => '?');
    const params = insertable.map((c) => entity[c.propertyName]);
    const sql = `INSERT INTO ${metadata.tableName} (${columnNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const firstPk = metadata.primaryKeys[0];
    const returningPk =
      firstPk && metadata.columns.find((c) => c.propertyName === firstPk)?.isGenerated
        ? firstPk
        : undefined;
    return { sql, params, returningPk };
  }

  private generateUpdateSql(
    entity: any,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata
  ): { sql: string; params: any[] } {
    const updatable = metadata.columns.filter(
      (c) => !metadata.primaryKeys.includes(c.propertyName) && !c.isGenerated
    );
    if (updatable.length === 0) throw new Error(`No updatable columns for ${metadata.target.name}`);
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

function prepareMssqlSql(sql: string, params: any[]): { sql: string; params: any[] } {
  if (!params || params.length === 0) return { sql, params: [] };
  let index = 0;
  const mapped = sql.replace(/\?/g, () => `@p${++index}`);
  return { sql: mapped, params };
}

function safeRequireMssql(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('mssql');
  } catch (e) {
    throw new Error(
      'Package "mssql" is required for MssqlProvider. Install it with: npm install mssql'
    );
  }
}

function mapMssqlError(err: any): Error {
  const number = err?.number;
  const message = err?.message || String(err);
  if (number === 2627 || number === 2601) {
    return new (require('../types').UniqueConstraintError)(message, String(number));
  }
  const DatabaseError = require('../types').DatabaseError;
  return new DatabaseError(message, String(number));
}
