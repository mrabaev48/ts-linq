import * as sqlite3 from 'sqlite3';
import { DatabaseProvider } from './DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { EntityMetadata, ColumnMetadata } from '../types';
import { SqlHelper } from '../utils/SqlHelper';

/**
 * SQLite implementation of `DatabaseProvider` using the `sqlite3` package.
 * Handles connection lifecycle, DDL/DML generation and execution, and
 * simple value conversions between JS and SQLite.
 */
export class SQLiteProvider extends DatabaseProvider {
    private db: sqlite3.Database | null = null;

    constructor(connectionString: string) {
        super(connectionString);
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
        const sql = this.generateCreateTableSql(entityMetadata);
        await this.executeNonQuery(sql);

        // Create indexes
        for (const index of entityMetadata.indexes) {
            const indexSql = this.generateCreateIndexSql(entityMetadata.tableName, index);
            await this.executeNonQuery(indexSql);
        }
    }

    /** Insert the entity and set generated primary key when applicable. */
    public async insert<T>(entity: T, entityClass: Function): Promise<T> {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }

        const { sql, params } = this.generateInsertSql(entity, metadata);
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    // Set the generated ID if applicable
                    const primaryKey = metadata.primaryKeys[0];
                    if (primaryKey && this.lastID) {
                        const primaryKeyColumn = metadata.columns.find(c => c.propertyName === primaryKey);
                        if (primaryKeyColumn && primaryKeyColumn.isGenerated) {
                            (entity as any)[primaryKey] = this.lastID;
                        }
                    }
                    resolve(entity);
                }
            });
        });
    }

    /** Update the entity row by primary key; throws if nothing affected. */
    public async update<T>(entity: T, entityClass: Function): Promise<T> {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }

        const { sql, params } = this.generateUpdateSql(entity, metadata);
        const affectedRows = await this.executeNonQuery(sql, params);
        
        if (affectedRows === 0) {
            throw new Error(`No rows were updated. Entity may not exist or no changes detected.`);
        }
        
        return entity;
    }

    /** Delete the entity row by primary key; throws if nothing affected. */
    public async delete<T>(entity: T, entityClass: Function): Promise<void> {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }

        const { sql, params } = this.generateDeleteSql(entity, metadata);
        const affectedRows = await this.executeNonQuery(sql, params);
        
        if (affectedRows === 0) {
            throw new Error(`No rows were deleted. Entity may not exist.`);
        }
    }

    /** Fetch a single entity by primary key value. */
    public async findById<T>(id: any, entityClass: new () => T): Promise<T | null> {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }

        const primaryKey = metadata.primaryKeys[0];
        if (!primaryKey) {
            throw new Error(`No primary key defined for ${entityClass.name}`);
        }

        const primaryKeyColumn = metadata.columns.find(c => c.propertyName === primaryKey);
        if (!primaryKeyColumn) {
            throw new Error(`Primary key column not found for ${entityClass.name}`);
        }

        const sql = `SELECT * FROM ${metadata.tableName} WHERE ${primaryKeyColumn.columnName} = ?`;
        const results = await this.executeQuery<any>(sql, [id]);
        
        return results.length > 0 ? this.mapRowToEntity(results[0], entityClass) : null;
    }

    /** Fetch all rows for the given entity type. */
    public async findAll<T>(entityClass: new () => T): Promise<T[]> {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }

        const sql = `SELECT * FROM ${metadata.tableName}`;
        const results = await this.executeQuery<any>(sql);
        
        return results.map(row => this.mapRowToEntity(row, entityClass));
    }

    /** Fetch rows that match a simple conditions object. */
    public async findWhere<T>(entityClass: new () => T, conditions: any): Promise<T[]> {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }

        const { whereClause, params } = SqlHelper.buildWhereClause(conditions);
        const sql = `SELECT * FROM ${metadata.tableName} WHERE ${whereClause}`;
        const results = await this.executeQuery<any>(sql, params);
        
        return results.map(row => this.mapRowToEntity(row, entityClass));
    }

    /** Execute a query and return raw rows. */
    public async executeQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(new Error(`Query execution failed: ${err.message}\nSQL: ${sql}\nParams: ${JSON.stringify(params)}`));
                } else {
                    resolve(rows as T[]);
                }
            });
        });
    }

    /** Execute a non-query statement and return affected rows count. */
    public async executeNonQuery(sql: string, params: any[] = []): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(new Error(`Non-query execution failed: ${err.message}\nSQL: ${sql}\nParams: ${JSON.stringify(params)}`));
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
        await this.executeNonQuery('BEGIN TRANSACTION');
        this.inTransaction = true;
    }

    /** Commit the current SQLite transaction. */
    public async commitTransaction(): Promise<void> {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress');
        }
        await this.executeNonQuery('COMMIT');
        this.inTransaction = false;
    }

    /** Roll back the current SQLite transaction. */
    public async rollbackTransaction(): Promise<void> {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress');
        }
        await this.executeNonQuery('ROLLBACK');
        this.inTransaction = false;
    }

    /** Generate CREATE TABLE SQL for the entity. */
    private generateCreateTableSql(metadata: EntityMetadata): string {
        if (!metadata || !metadata.columns) {
            throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
        }
        const columns = metadata.columns.map(col => this.generateColumnDefinition(col));
        
        if (metadata.primaryKeys.length > 0) {
            const primaryKeyColumns = metadata.primaryKeys.map(pk => {
                const column = metadata.columns.find(c => c.propertyName === pk);
                return column ? column.columnName : pk;
            });
            
            // Special handling for SQLite AUTOINCREMENT
            if (metadata.primaryKeys.length === 1) {
                const pkColumn = metadata.columns.find(c => c.propertyName === metadata.primaryKeys[0]);
                if (pkColumn && pkColumn.isGenerated && this.mapTypeToSQLite(pkColumn.type) === 'INTEGER') {
                    // For single INTEGER AUTOINCREMENT primary key, use inline PRIMARY KEY AUTOINCREMENT
                    const pkIndex = metadata.columns.findIndex(c => c.propertyName === metadata.primaryKeys[0]);
                    columns[pkIndex] += ' PRIMARY KEY AUTOINCREMENT';
                } else {
                    columns.push(`PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
                }
            } else {
                columns.push(`PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
            }
        }

        return `CREATE TABLE IF NOT EXISTS ${metadata.tableName} (${columns.join(', ')})`;
    }

    /** Generate a single column definition for CREATE TABLE. */
    private generateColumnDefinition(column: ColumnMetadata): string {
        let definition = `${column.columnName} ${this.mapTypeToSQLite(column.type)}`;
        
        if (column.length) {
            definition += `(${column.length})`;
        }
        
        // For SQLite, AUTOINCREMENT must be used with PRIMARY KEY and INTEGER type
        if (column.isGenerated && this.mapTypeToSQLite(column.type) === 'INTEGER') {
            // Skip NOT NULL and other constraints for auto-increment primary key
            // The PRIMARY KEY constraint will be added separately
            definition += '';
        } else {
            if (!column.nullable) {
                definition += ' NOT NULL';
            }
            
            if (column.defaultValue !== undefined) {
                definition += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
            }
        }
        
        return definition;
    }

    /** Generate CREATE INDEX SQL for an index metadata item. */
    private generateCreateIndexSql(tableName: string, index: any): string {
        const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
        return `CREATE ${uniqueKeyword}INDEX IF NOT EXISTS ${index.name} ON ${tableName} (${index.columns.join(', ')})`;
    }

    /** Generate INSERT SQL and parameter list for the given entity. */
    private generateInsertSql(entity: any, metadata: EntityMetadata): { sql: string; params: any[] } {
        const insertableColumns = metadata.columns.filter(col => {
            // Exclude auto-generated columns unless they have a value
            if (col.isGenerated) {
                return entity[col.propertyName] !== undefined && entity[col.propertyName] !== null;
            }
            return true;
        });
        
        const columnNames = insertableColumns.map(col => col.columnName);
        const placeholders = insertableColumns.map(() => '?');
        const params = insertableColumns.map(col => {
            const value = entity[col.propertyName];
            return this.convertValueForDatabase(value, col.type);
        });

        const sql = `INSERT INTO ${metadata.tableName} (${columnNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
        return { sql, params };
    }

    /** Generate UPDATE SQL and params based on non-PK columns and PK WHERE clause. */
    private generateUpdateSql(entity: any, metadata: EntityMetadata): { sql: string; params: any[] } {
        const updatableColumns = metadata.columns.filter(col => 
            !metadata.primaryKeys.includes(col.propertyName) && !col.isGenerated
        );
        
        if (updatableColumns.length === 0) {
            throw new Error(`No updatable columns found for entity ${metadata.target.name}`);
        }
        
        const setClauses = updatableColumns.map(col => `${col.columnName} = ?`);
        const setParams = updatableColumns.map(col => {
            const value = entity[col.propertyName];
            return this.convertValueForDatabase(value, col.type);
        });

        const primaryKeyConditions: string[] = [];
        const whereParams: any[] = [];

        for (const pkProperty of metadata.primaryKeys) {
            const pkColumn = metadata.columns.find(col => col.propertyName === pkProperty);
            if (!pkColumn) {
                throw new Error(`Primary key column ${pkProperty} not found for entity ${metadata.target.name}`);
            }
            primaryKeyConditions.push(`${pkColumn.columnName} = ?`);
            whereParams.push(entity[pkProperty]);
        }

        if (primaryKeyConditions.length === 0) {
            throw new Error(`No primary key values found for entity ${metadata.target.name}`);
        }

        const whereClause = primaryKeyConditions.join(' AND ');
        const sql = `UPDATE ${metadata.tableName} SET ${setClauses.join(', ')} WHERE ${whereClause}`;
        return { sql, params: [...setParams, ...whereParams] };
    }

    /** Generate DELETE SQL and params using primary key values. */
    private generateDeleteSql(entity: any, metadata: EntityMetadata): { sql: string; params: any[] } {
        const primaryKeyConditions: string[] = [];
        const params: any[] = [];

        for (const pkProperty of metadata.primaryKeys) {
            const pkColumn = metadata.columns.find(col => col.propertyName === pkProperty);
            if (!pkColumn) {
                throw new Error(`Primary key column ${pkProperty} not found for entity ${metadata.target.name}`);
            }
            primaryKeyConditions.push(`${pkColumn.columnName} = ?`);
            params.push(entity[pkProperty]);
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
        switch (type.toUpperCase()) {
            case 'TEXT':
            case 'STRING':
                return 'TEXT';
            case 'INTEGER':
            case 'NUMBER':
                return 'INTEGER';
            case 'REAL':
            case 'FLOAT':
            case 'DOUBLE':
                return 'REAL';
            case 'BOOLEAN':
                return 'INTEGER';
            case 'DATETIME':
            case 'DATE':
                return 'TEXT';
            case 'BLOB':
                return 'BLOB';
            default:
                return 'TEXT';
        }
    }

    /** Map a database row object to a new entity instance using metadata. */
    private mapRowToEntity<T>(row: any, entityClass: new () => T): T {
        const entity = new entityClass();
        const metadata = MetadataStorage.getEntity(entityClass);
        
        if (metadata) {
            for (const column of metadata.columns) {
                if (row.hasOwnProperty(column.columnName)) {
                    (entity as any)[column.propertyName] = this.convertValueFromDatabase(row[column.columnName], column.type);
                }
            }
        } else {
            // Fallback: copy all properties
            Object.assign(entity as any, row);
        }
        
        return entity;
    }

    /** Convert a JS value to a DB-storable value according to type. */
    private convertValueForDatabase(value: any, type: string): any {
        if (value === null || value === undefined) {
            return null;
        }

        switch (type.toUpperCase()) {
            case 'BOOLEAN':
                return value ? 1 : 0;
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
    private convertValueFromDatabase(value: any, type: string): any {
        if (value === null || value === undefined) {
            return value;
        }

        switch (type.toUpperCase()) {
            case 'BOOLEAN':
                return Boolean(value);
            case 'INTEGER':
            case 'NUMBER':
                return Number(value);
            case 'DATETIME':
            case 'DATE':
                return new Date(value);
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
