import { DatabaseProvider, MetadataStorage, OptimisticConcurrencyError, SqlHelper } from '@ts-linq/core';
import { SQLiteDialect, SQLiteDdlStrategy } from '@ts-linq/dialect-sqlite';
import { createSqliteDb } from '../sqlite/PoolAdapter';
import { mapSqliteError } from '../sqlite/ErrorMapper';
export class SQLiteProvider extends DatabaseProvider {
    constructor(connectionString, logger, middlewares, softDelete, retryPolicy) {
        super(connectionString, logger, middlewares, softDelete, retryPolicy);
        this.db = null;
        this.ddl = new SQLiteDdlStrategy();
        this.providerName = 'sqlite';
    }
    async connect() {
        this.db = createSqliteDb(this.connectionString);
        // Enable foreign keys; ignore callback result
        this.db.run('PRAGMA foreign_keys = ON');
        this.isConnected = true;
        await Promise.resolve();
    }
    async disconnect() {
        await new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            }
            else
                resolve();
        });
        this.db = null;
        this.isConnected = false;
    }
    async createTable(entityMetadata) {
        const sql = this.ddl.generateCreateTableSql(entityMetadata);
        await this.executeNonQuery(sql);
        for (const index of entityMetadata.indexes) {
            const indexSql = this.ddl.generateCreateIndexSql(entityMetadata.tableName, index);
            await this.executeNonQuery(indexSql);
        }
    }
    async insert(entity, entityClass) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const { sql, params } = this.generateInsertSql(entity, metadata);
        await this.executeNonQuery(sql, params);
        const primaryKey = metadata.primaryKeys[0];
        if (primaryKey) {
            const primaryKeyColumn = metadata.columns.find((c) => c.propertyName === primaryKey);
            if (primaryKeyColumn &&
                primaryKeyColumn.isGenerated &&
                this.mapTypeToSQLite(primaryKeyColumn.type) === 'INTEGER') {
                const rows = await this.executeQuery('SELECT last_insert_rowid() AS id');
                const id = rows && rows[0]?.id;
                if (id !== undefined)
                    entity[primaryKey] = id;
            }
        }
        return entity;
    }
    async update(entity, entityClass) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const versionCol = metadata.columns.find((c) => c.isVersion);
        const { sql, params } = this.generateUpdateSql(entity, metadata, versionCol);
        const affectedRows = await this.executeNonQuery(sql, params);
        if (affectedRows === 0) {
            if (versionCol)
                throw new OptimisticConcurrencyError();
            throw new Error('No rows were updated.');
        }
        if (versionCol) {
            const prop = versionCol.propertyName;
            const rec = entity;
            const current = typeof rec[prop] === 'number' ? rec[prop] : Number(rec[prop] ?? 0);
            rec[prop] = current + 1;
        }
        return entity;
    }
    async delete(entity, entityClass) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const { sql, params } = this.generateDeleteSql(entity, metadata);
        const affectedRows = await this.executeNonQuery(sql, params);
        if (affectedRows === 0)
            throw new Error('No rows were deleted.');
    }
    async findById(id, entityClass) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const primaryKey = metadata.primaryKeys[0];
        const pkCol = metadata.columns.find((c) => c.propertyName === primaryKey);
        if (!pkCol)
            throw new Error(`Primary key column not found for ${entityClass.name}`);
        let sql = `SELECT * FROM ${metadata.tableName} WHERE ${pkCol.columnName} = ?`;
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
    async findAll(entityClass) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
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
    async findWhere(entityClass, conditions) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const { whereClause, params } = SqlHelper.buildWhereClause(conditions);
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
    async findWhereIn(entityClass, column, values) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
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
    async doExecuteQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db)
                return reject(new Error('Database not connected'));
            this.db.all(sql, params, (err, rows) => {
                if (err)
                    reject(mapSqliteError(err));
                else
                    resolve(rows);
            });
        });
    }
    async doExecuteNonQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db)
                return reject(new Error('Database not connected'));
            this.db.run(sql, params, function (err) {
                if (err)
                    reject(mapSqliteError(err));
                else
                    resolve(this.changes);
            });
        });
    }
    async beginTransaction() {
        if (this.inTransaction)
            throw new Error('Transaction already in progress');
        this.currentTraceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        await this.executeNonQuery('BEGIN TRANSACTION');
        this.inTransaction = true;
        this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
    }
    async commitTransaction() {
        if (!this.inTransaction)
            throw new Error('No transaction in progress');
        await this.executeNonQuery('COMMIT');
        this.inTransaction = false;
        const tid = this.currentTraceId;
        this.currentTraceId = undefined;
        this.logger?.transactionEnd?.({ traceId: tid, provider: this.providerName });
    }
    async rollbackTransaction() {
        if (!this.inTransaction)
            throw new Error('No transaction in progress');
        await this.executeNonQuery('ROLLBACK');
        this.inTransaction = false;
        const tid = this.currentTraceId;
        this.currentTraceId = undefined;
        this.logger?.transactionEnd?.({ traceId: tid, provider: this.providerName });
    }
    getDialect() {
        return new SQLiteDialect();
    }
    generateInsertSql(entity, metadata) {
        const insertableColumns = metadata.columns.filter((col) => {
            const value = entity[col.propertyName];
            if (value !== undefined)
                return (!col.isGenerated || value !== null) && !col.isComputed;
            return false;
        });
        const columnNames = insertableColumns.map((col) => col.columnName);
        const placeholders = insertableColumns.map(() => '?');
        const params = insertableColumns.map((col) => this.coerceToSqlParameter(entity[col.propertyName]));
        const sql = `INSERT INTO ${metadata.tableName} (${columnNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
        return { sql, params };
    }
    generateUpdateSql(entity, metadata, versionCol) {
        const updatableColumns = metadata.columns.filter((col) => !metadata.primaryKeys.includes(col.propertyName) && !col.isGenerated && !col.isComputed);
        if (updatableColumns.length === 0)
            throw new Error(`No updatable columns found for entity ${metadata.target.name}`);
        const setClauses = updatableColumns.map((col) => `${col.columnName} = ?`);
        const setParams = updatableColumns.map((col) => this.coerceToSqlParameter(entity[col.propertyName]));
        if (versionCol)
            setClauses.push(`${versionCol.columnName} = ${versionCol.columnName} + 1`);
        const primaryKeyConditions = [];
        const whereParams = [];
        for (const pkProperty of metadata.primaryKeys) {
            const pkColumn = metadata.columns.find((col) => col.propertyName === pkProperty);
            if (!pkColumn)
                throw new Error(`Primary key column ${pkProperty} not found for entity ${metadata.target.name}`);
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
    generateDeleteSql(entity, metadata) {
        const primaryKeyConditions = [];
        const params = [];
        for (const pkProperty of metadata.primaryKeys) {
            const pkColumn = metadata.columns.find((col) => col.propertyName === pkProperty);
            if (!pkColumn)
                throw new Error(`Primary key column ${pkProperty} not found for entity ${metadata.target.name}`);
            primaryKeyConditions.push(`${pkColumn.columnName} = ?`);
            params.push(this.coerceToSqlParameter(entity[pkProperty]));
        }
        const whereClause = primaryKeyConditions.join(' AND ');
        const sql = `DELETE FROM ${metadata.tableName} WHERE ${whereClause}`;
        return { sql, params };
    }
    mapRowToEntity(row, entityClass) {
        const entity = new entityClass();
        const metadata = MetadataStorage.getEntity(entityClass);
        if (metadata) {
            for (const column of metadata.columns) {
                if (Object.prototype.hasOwnProperty.call(row, column.columnName)) {
                    entity[column.propertyName] = this.convertValueFromDatabase(row[column.columnName], column.type);
                }
            }
        }
        else {
            Object.assign(entity, row);
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.notifyEntityMaterialized(entity, metadata);
        return entity;
    }
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
    mapTypeToSQLite(type) {
        return this.ddl.mapTypeToSQLite(type);
    }
    convertValueFromDatabase(value, type) {
        if (value === null || value === undefined)
            return value;
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
//# sourceMappingURL=SQLiteProvider.js.map