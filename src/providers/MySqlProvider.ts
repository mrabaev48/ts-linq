import { DatabaseProvider } from './DatabaseProvider';
import { EntityMetadata, ColumnMetadata, SqlLogger } from '../types';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SqlHelper } from '../utils/SqlHelper';

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
 *   const u = new User(); u.name = 'Bob';
 *   ctx.users.add(u);
 *   await ctx.saveChanges();
 *   const all = await ctx.users.toArray();
 *   await ctx.dispose();
 * }
 */
export class MySqlProvider extends DatabaseProvider {
  private pool: any | null = null;
  constructor(connectionString: string, logger?: SqlLogger) {
    super(connectionString, logger);
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
    const sql = this.generateCreateTableSql(entity);
    await this.executeNonQuery(sql);
    for (const idx of entity.indexes) {
      await this.executeNonQuery(this.generateCreateIndexSql(entity.tableName, idx));
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
    const { sql, params } = this.generateUpdateSql(entity as any, metadata);
    const n = await this.executeNonQuery(sql, params);
    if (n === 0) throw new Error('No rows were updated.');
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
    const pkCol = metadata.columns.find(c => c.propertyName === pk)!;
    const rows = await this.executeQuery<any>(`SELECT * FROM ${metadata.tableName} WHERE ${pkCol.columnName} = ?`, [id]);
    return rows.length ? this.mapRowToEntity(rows[0], entityClass) : null;
  }

  public async findAll<T>(entityClass: new () => T): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const rows = await this.executeQuery<any>(`SELECT * FROM ${metadata.tableName}`);
    return rows.map(r => this.mapRowToEntity(r, entityClass));
  }

  public async findWhere<T>(entityClass: new () => T, conditions: any): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const { whereClause, params } = SqlHelper.buildWhereClause(conditions);
    const rows = await this.executeQuery<any>(`SELECT * FROM ${metadata.tableName} WHERE ${whereClause}`, params);
    return rows.map(r => this.mapRowToEntity(r, entityClass));
  }

  public async findWhereIn<T>(entityClass: new () => T, column: string, values: any[]): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    if (!values?.length) return [];
    const columnMeta = metadata.columns.find(c => c.propertyName === column || c.columnName === column);
    const columnName = columnMeta ? columnMeta.columnName : column;
    const placeholders = values.map(() => '?').join(', ');
    const rows = await this.executeQuery<any>(`SELECT * FROM ${metadata.tableName} WHERE ${columnName} IN (${placeholders})`, values);
    return rows.map(r => this.mapRowToEntity(r, entityClass));
  }

  protected async doExecuteQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.isConnected) await this.connect();
    const [rows] = await this.pool.query(sql, params);
    return rows as T[];
  }

  protected async doExecuteNonQuery(sql: string, params: any[] = []): Promise<number> {
    if (!this.isConnected) await this.connect();
    const [result] = await this.pool.execute(sql, params);
    // mysql2 returns OkPacket with affectedRows
    return (result as any)?.affectedRows ?? 0;
  }

  public async beginTransaction(): Promise<void> {
    if (!this.isConnected) await this.connect();
    await this.pool.query('START TRANSACTION');
    this.inTransaction = true;
  }
  public async commitTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    await this.pool.query('COMMIT');
    this.inTransaction = false;
  }
  public async rollbackTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    await this.pool.query('ROLLBACK');
    this.inTransaction = false;
  }

  private generateCreateTableSql(metadata: EntityMetadata): string {
    if (!metadata || !metadata.columns) {
      throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
    }
    const cols: string[] = metadata.columns.map(c => this.generateColumnDefinition(c));
    if (metadata.primaryKeys.length) {
      const pkCols = metadata.primaryKeys.map(pk => metadata.columns.find(c => c.propertyName === pk)?.columnName || pk);
      cols.push(`PRIMARY KEY (${pkCols.join(', ')})`);
    }
    return `CREATE TABLE IF NOT EXISTS ${metadata.tableName} (${cols.join(', ')})`;
  }
  private generateColumnDefinition(column: ColumnMetadata): string {
    let def = `${column.columnName} ${mapTypeToMySql(column.type)}`;
    if (column.length) def += `(${column.length})`;
    if (!column.nullable) def += ' NOT NULL';
    if (column.defaultValue !== undefined) def += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
    return def;
  }
  private generateCreateIndexSql(table: string, index: { name: string; columns: string[]; unique: boolean }): string {
    const uniq = index.unique ? 'UNIQUE ' : '';
    return `CREATE ${uniq}INDEX IF NOT EXISTS ${index.name} ON ${table} (${index.columns.join(', ')})`;
  }
  private generateInsertSql(entity: any, metadata: EntityMetadata): { sql: string; params: any[] } {
    const insertable = metadata.columns.filter(c => !c.isGenerated || entity[c.propertyName] !== undefined);
    const names = insertable.map(c => c.columnName);
    const placeholders = insertable.map(() => '?');
    const params = insertable.map(c => entity[c.propertyName]);
    return { sql: `INSERT INTO ${metadata.tableName} (${names.join(', ')}) VALUES (${placeholders.join(', ')})`, params };
  }
  private generateUpdateSql(entity: any, metadata: EntityMetadata): { sql: string; params: any[] } {
    const updatable = metadata.columns.filter(c => !metadata.primaryKeys.includes(c.propertyName) && !c.isGenerated);
    const setClauses = updatable.map(c => `${c.columnName} = ?`);
    const setParams = updatable.map(c => entity[c.propertyName]);
    const whereClauses: string[] = [];
    const whereParams: any[] = [];
    for (const pk of metadata.primaryKeys) {
      const col = metadata.columns.find(c => c.propertyName === pk)!;
      whereClauses.push(`${col.columnName} = ?`);
      whereParams.push(entity[pk]);
    }
    const sql = `UPDATE ${metadata.tableName} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    return { sql, params: [...setParams, ...whereParams] };
  }
  private generateDeleteSql(entity: any, metadata: EntityMetadata): { sql: string; params: any[] } {
    const whereClauses: string[] = [];
    const params: any[] = [];
    for (const pk of metadata.primaryKeys) {
      const col = metadata.columns.find(c => c.propertyName === pk)!;
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

function safeRequireMysql2(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('mysql2/promise');
  } catch (e) {
    throw new Error('Package "mysql2" is required for MySqlProvider. Install it with: npm install mysql2');
  }
}


