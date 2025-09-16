"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteProvider = void 0;
const sqlite3 = __importStar(require("sqlite3"));
const core_1 = require("@ts-linq/core");
const SQLiteDialect_1 = require("./SQLiteDialect");
const SQLiteDdlStrategy_1 = require("./SQLiteDdlStrategy");
/**
 * SQLite implementation of `DatabaseProvider` using the `sqlite3` package.
 * Handles connection lifecycle, DDL/DML generation and execution, and
 * simple value conversions between JS and SQLite.
 *
 * Note: sqlite3 driver is callback-based; provider wraps calls into Promises.
 */
class SQLiteProvider extends core_1.DatabaseProvider {
    constructor(connectionString, logger, middlewares, softDelete, retryPolicy) {
        super(connectionString, logger, middlewares, softDelete, retryPolicy);
        this.db = null;
        this.ddl = new SQLiteDdlStrategy_1.SQLiteDdlStrategy();
        this.providerName = 'sqlite';
    }
    /** Open a connection to the SQLite database and enable foreign keys. */
    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.connectionString, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    this.isConnected = true;
                    // Enable foreign key constraints
                    this.db.run('PRAGMA foreign_keys = ON');
                    resolve();
                }
            });
        });
    }
    /** Close the SQLite database connection if open. */
    async disconnect() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        this.isConnected = false;
                        this.db = null;
                        resolve();
                    }
                });
            }
            else {
                resolve();
            }
        });
    }
    /** Create a table from entity metadata and ensure indexes exist. */
    async createTable(entityMetadata) {
        const sql = this.ddl.generateCreateTableSql(entityMetadata);
        await this.executeNonQuery(sql);
        // Create indexes
        for (const index of entityMetadata.indexes) {
            const indexSql = this.ddl.generateCreateIndexSql(entityMetadata.tableName, index);
            await this.executeNonQuery(indexSql);
        }
    }
    /** Insert the entity and set generated primary key when applicable. */
    async insert(entity, entityClass) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }
        const { sql, params } = this.generateInsertSql(entity, metadata);
        await this.executeNonQuery(sql, params);
        // Handle generated PK via last_insert_rowid when applicable
        const primaryKey = metadata.primaryKeys[0];
        if (primaryKey) {
            const primaryKeyColumn = metadata.columns.find((c) => c.propertyName === primaryKey);
            if (primaryKeyColumn &&
                primaryKeyColumn.isGenerated &&
                this.mapTypeToSQLite(primaryKeyColumn.type) === 'INTEGER') {
                const rows = await this.executeQuery('SELECT last_insert_rowid() AS id');
                const id = rows && rows[0]?.id;
                if (id !== undefined) {
                    entity[primaryKey] = id;
                }
            }
        }
        return entity;
    }
    /** Update the entity row by primary key; supports optimistic concurrency via version column; throws if nothing affected. */
    async update(entity, entityClass) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }
        const versionCol = metadata.columns.find((c) => c.isVersion);
        const { sql, params } = this.generateUpdateSql(entity, metadata, versionCol);
        const affectedRows = await this.executeNonQuery(sql, params);
        if (affectedRows === 0) {
            if (versionCol)
                throw new core_1.OptimisticConcurrencyError();
            throw new Error(`No rows were updated. Entity may not exist or no changes detected.`);
        }
        // increment version in entity
        if (versionCol) {
            const prop = versionCol.propertyName;
            const rec = entity;
            const current = typeof rec[prop] === 'number' ? rec[prop] : Number(rec[prop] ?? 0);
            rec[prop] = current + 1;
        }
        return entity;
    }
    /** Delete the entity row by primary key; throws if nothing affected. */
    async delete(entity, entityClass) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
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
    async findById(id, entityClass) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
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
            if (has)
                sql += ` AND ${flag} = 0`;
        }
        const results = await this.executeQuery(sql, [
            this.coerceToSqlParameter(id)
        ]);
        return results.length > 0 ? this.mapRowToEntity(results[0], entityClass) : null;
    }
    /** Fetch all rows for the given entity type. */
    async findAll(entityClass) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }
        let sql = `SELECT * FROM ${metadata.tableName}`;
        if (this.softDelete?.enabled) {
            const flag = this.softDelete.column ?? 'isDeleted';
            const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
            if (has)
                sql += ` WHERE ${flag} = 0`;
        }
        const results = await this.executeQuery(sql);
        return results.map((row) => this.mapRowToEntity(row, entityClass));
    }
    /** Fetch rows that match a simple conditions object. */
    async findWhere(entityClass, conditions) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }
        const { whereClause, params } = core_1.SqlHelper.buildWhereClause(conditions);
        let sql = `SELECT * FROM ${metadata.tableName} WHERE ${whereClause}`;
        if (this.softDelete?.enabled) {
            const flag = this.softDelete.column ?? 'isDeleted';
            const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
            if (has)
                sql += ` AND ${flag} = 0`;
        }
        const results = await this.executeQuery(sql, params);
        return results.map((row) => this.mapRowToEntity(row, entityClass));
    }
    /** Fetch rows where a single column value is within a list (IN clause). */
    async findWhereIn(entityClass, column, values) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }
        if (!Array.isArray(values) || values.length === 0)
            return [];
        const columnMeta = metadata.columns.find((c) => c.propertyName === column || c.columnName === column);
        const columnName = columnMeta ? columnMeta.columnName : column;
        const placeholders = values.map(() => '?').join(', ');
        let sql = `SELECT * FROM ${metadata.tableName} WHERE ${columnName} IN (${placeholders})`;
        if (this.softDelete?.enabled) {
            const flag = this.softDelete.column ?? 'isDeleted';
            const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
            if (has)
                sql += ` AND ${flag} = 0`;
        }
        const coerced = values.map((v) => this.coerceToSqlParameter(v));
        const results = await this.executeQuery(sql, coerced);
        return results.map((row) => this.mapRowToEntity(row, entityClass));
    }
    /** Execute a query and return raw rows. */
    async doExecuteQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(mapSqliteError(err));
                }
                else {
                    resolve(rows);
                }
            });
        });
    }
    /** Execute a non-query statement and return affected rows count. */
    async doExecuteNonQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(mapSqliteError(err));
                }
                else {
                    resolve(this.changes);
                }
            });
        });
    }
    /** Begin a SQLite transaction. */
    async beginTransaction() {
        if (this.inTransaction) {
            throw new Error('Transaction already in progress');
        }
        this.currentTraceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        await this.executeNonQuery('BEGIN TRANSACTION');
        this.inTransaction = true;
        this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
    }
    /** Commit the current SQLite transaction. */
    async commitTransaction() {
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
    async rollbackTransaction() {
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
    getDialect() {
        return new SQLiteDialect_1.SQLiteDialect();
    }
    /** Generate INSERT SQL and parameter list for the given entity. */
    generateInsertSql(entity, metadata) {
        const insertableColumns = metadata.columns.filter((col) => {
            // Exclude columns without provided value to allow DB defaults
            const value = entity[col.propertyName];
            // include when value is defined (can be null intentionally)
            if (value !== undefined)
                return !col.isGenerated || value !== null;
            return false;
        });
        const columnNames = insertableColumns.map((col) => col.columnName);
        const placeholders = insertableColumns.map(() => '?');
        const params = insertableColumns.map((col) => this.coerceToSqlParameter(entity[col.propertyName]));
        const sql = `INSERT INTO ${metadata.tableName} (${columnNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
        return { sql, params };
    }
    /** Generate UPDATE SQL and params based on non-PK columns and PK WHERE clause. */
    generateUpdateSql(entity, metadata, versionCol) {
        const updatableColumns = metadata.columns.filter((col) => !metadata.primaryKeys.includes(col.propertyName) && !col.isGenerated);
        if (updatableColumns.length === 0) {
            throw new Error(`No updatable columns found for entity ${metadata.target.name}`);
        }
        const setClauses = updatableColumns.map((col) => `${col.columnName} = ?`);
        const setParams = updatableColumns.map((col) => this.coerceToSqlParameter(entity[col.propertyName]));
        if (versionCol) {
            setClauses.push(`${versionCol.columnName} = ${versionCol.columnName} + 1`);
        }
        const primaryKeyConditions = [];
        const whereParams = [];
        for (const pkProperty of metadata.primaryKeys) {
            const pkColumn = metadata.columns.find((col) => col.propertyName === pkProperty);
            if (!pkColumn) {
                throw new Error(`Primary key column ${pkProperty} not found for entity ${metadata.target.name}`);
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
    generateDeleteSql(entity, metadata) {
        const primaryKeyConditions = [];
        const params = [];
        for (const pkProperty of metadata.primaryKeys) {
            const pkColumn = metadata.columns.find((col) => col.propertyName === pkProperty);
            if (!pkColumn) {
                throw new Error(`Primary key column ${pkProperty} not found for entity ${metadata.target.name}`);
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
    mapTypeToSQLite(type) {
        return this.ddl.mapTypeToSQLite(type);
    }
    /** Map a database row object to a new entity instance using metadata. */
    mapRowToEntity(row, entityClass) {
        const entity = new entityClass();
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (metadata) {
            for (const column of metadata.columns) {
                if (Object.prototype.hasOwnProperty.call(row, column.columnName)) {
                    entity[column.propertyName] = this.convertValueFromDatabase(row[column.columnName], column.type);
                }
            }
        }
        else {
            // Fallback: copy all properties
            Object.assign(entity, row);
        }
        // notify middleware
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.notifyEntityMaterialized(entity, metadata);
        return entity;
    }
    /** Coerce arbitrary value into SQL parameter type accepted by SQLite. */
    coerceToSqlParameter(value) {
        if (value === null ||
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            value instanceof Date ||
            value instanceof Uint8Array) {
            return value;
        }
        try {
            return JSON.stringify(value ?? null);
        }
        catch {
            return String(value);
        }
    }
    /** Convert a JS value to a DB-storable value according to type. */
    convertValueForDatabase(value, type) {
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
    convertValueFromDatabase(value, type) {
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
                    }
                    catch {
                        return value;
                    }
                }
                return value;
            default:
                return value;
        }
    }
}
exports.SQLiteProvider = SQLiteProvider;
/** Map sqlite3 error to typed DatabaseError. */
function mapSqliteError(err) {
    const anyErr = err;
    const code = anyErr?.code;
    const message = anyErr?.message || String(err);
    if (!code)
        return new core_1.DatabaseError(message);
    // sqlite codes: https://www.sqlite.org/rescode.html (library-dependent)
    // Prefer FK if message indicates it
    if (message && message.toLowerCase().includes('foreign key')) {
        return new core_1.ForeignKeyConstraintError(message, code);
    }
    if (code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return new core_1.UniqueConstraintError(message, code);
    }
    if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || code === 'SQLITE_CONSTRAINT_TRIGGER') {
        return new core_1.ForeignKeyConstraintError(message, code);
    }
    return new core_1.DatabaseError(message, code);
}
//# sourceMappingURL=SQLiteProvider.js.map