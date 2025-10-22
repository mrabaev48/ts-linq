import { DatabaseProvider, OptimisticConcurrencyError, MetadataStorage, SqlHelper, UniqueConstraintError, DatabaseError } from '@ts-linq/core';
import { MysqlDialect } from '@ts-linq/dialect-mysql';
import { MySqlDdlStrategy } from '@ts-linq/dialect-mysql';
export class MySqlProvider extends DatabaseProvider {
    constructor(connectionString, logger, middlewares, softDelete, retryPolicy, poolOptions, healthCheck) {
        super(connectionString, logger, middlewares, softDelete, retryPolicy, poolOptions, healthCheck);
        this.pool = null;
        this.ddl = new MySqlDdlStrategy();
        this.providerName = 'mysql';
    }
    async connect() {
        if (this.isConnected)
            return;
        const mysql = safeRequireMysql2();
        const opts = this.poolOptions || {};
        // Map generic pool options to mysql2 pool options when available
        const mysqlConfig = { uri: this.connectionString };
        if (typeof opts.max === 'number')
            mysqlConfig.connectionLimit = opts.max;
        if (typeof opts.acquireTimeoutMs === 'number')
            mysqlConfig.acquireTimeout = opts.acquireTimeoutMs;
        if (typeof opts.connectionTimeoutMs === 'number')
            mysqlConfig.connectTimeout = opts.connectionTimeoutMs;
        // Note: mysql2 uses waitForConnections/queueLimit; idle timeout is managed by server or 'idleTimeout' in some forks
        this.pool = mysql.createPool(mysqlConfig);
        this.isConnected = true;
        // Health checks
        await (async () => {
            // ensure at least one awaited async in connect() for lint rule
            /* noop */
        })();
        this.startHealthChecks(async () => {
            const started = Date.now();
            const pool = this.pool;
            const sql = this.healthCheck?.testQuery || 'SELECT 1';
            await pool.query(sql);
            return Date.now() - started;
        });
    }
    async disconnect() {
        this.stopHealthChecks();
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
        this.isConnected = false;
    }
    async createTable(entity) {
        const sql = this.ddl.generateCreateTableSql(entity);
        await this.executeNonQuery(sql);
        for (const idx of entity.indexes) {
            await this.executeNonQuery(this.ddl.generateCreateIndexSql(entity.tableName, idx));
        }
    }
    async insert(entity, entityClass) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const { sql, params } = this.generateInsertSql(entity, metadata);
        await this.executeNonQuery(sql, params);
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
    /** Upsert using INSERT ... ON DUPLICATE KEY UPDATE ... */
    async upsert(entity, entityClass) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const insertable = metadata.columns.filter((c) => !c.isGenerated || entity[c.propertyName] !== undefined);
        const names = insertable.map((c) => c.columnName);
        const placeholders = insertable.map(() => '?');
        const params = insertable.map((c) => entity[c.propertyName]);
        const updatable = metadata.columns.filter((c) => !metadata.primaryKeys.includes(c.propertyName) && !c.isGenerated);
        const updateSet = updatable.map((c) => `${c.columnName} = VALUES(${c.columnName})`).join(', ');
        const sql = `INSERT INTO ${metadata.tableName} (${names.join(', ')}) VALUES (${placeholders.join(', ')}) ON DUPLICATE KEY UPDATE ${updateSet}`;
        await this.executeNonQuery(sql, params);
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
        const pk = metadata.primaryKeys[0];
        const pkCol = metadata.columns.find((c) => c.propertyName === pk);
        let sql = `SELECT * FROM ${metadata.tableName} WHERE ${pkCol.columnName} = ?`;
        if (this.softDelete?.enabled) {
            const flag = this.softDelete.column ?? 'isDeleted';
            const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
            if (has)
                sql += ` AND ${flag} = 0`;
        }
        const rows = await this.executeQuery(sql, [
            this.coerceToSqlParameter(id)
        ]);
        return rows.length ? this.mapRowToEntity(rows[0], entityClass) : null;
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
        const rows = await this.executeQuery(sql);
        return rows.map((r) => this.mapRowToEntity(r, entityClass));
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
        const rows = await this.executeQuery(sql, params);
        return rows.map((r) => this.mapRowToEntity(r, entityClass));
    }
    async findWhereIn(entityClass, column, values) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        if (!values?.length)
            return [];
        const columnMeta = metadata.columns.find((c) => c.propertyName === column || c.columnName === column);
        const columnName = columnMeta ? columnMeta.columnName : column;
        const placeholders = values.map(() => '?').join(', ');
        let sql2 = `SELECT * FROM ${metadata.tableName} WHERE ${columnName} IN (${placeholders})`;
        if (this.softDelete?.enabled) {
            const flag = this.softDelete.column ?? 'isDeleted';
            const has = metadata.columns.some((c) => c.propertyName === flag || c.columnName === flag);
            if (has)
                sql2 += ` AND ${flag} = 0`;
        }
        const coerced = values.map((v) => this.coerceToSqlParameter(v));
        const rows = await this.executeQuery(sql2, coerced);
        return rows.map((r) => this.mapRowToEntity(r, entityClass));
    }
    async doExecuteQuery(sql, params = []) {
        try {
            if (!this.isConnected)
                await this.connect();
            const pool = this.pool;
            const [rows] = await pool.query(sql, params);
            return rows;
        }
        catch (e) {
            throw mapMySqlError(e);
        }
    }
    async doExecuteNonQuery(sql, params = []) {
        try {
            if (!this.isConnected)
                await this.connect();
            const pool = this.pool;
            const [result] = await pool.execute(sql, params);
            const affected = result?.affectedRows ?? 0;
            return affected;
        }
        catch (e) {
            throw mapMySqlError(e);
        }
    }
    /** Obtain MySQL EXPLAIN plan (JSON where supported) */
    async getExplainPlan(sql, params) {
        try {
            // Prefer EXPLAIN FORMAT=JSON for MySQL 5.7+/8.0+, fallback to plain EXPLAIN
            const explainJson = `EXPLAIN FORMAT=JSON ${sql}`;
            try {
                const rows = await this.doExecuteQuery(explainJson, params);
                const first = rows && rows[0];
                if (first)
                    return first;
            }
            catch {
                /* fall back */
            }
            const rows = await this.doExecuteQuery(`EXPLAIN ${sql}`, params);
            return rows;
        }
        catch {
            return undefined;
        }
    }
    async beginTransaction() {
        if (!this.isConnected)
            await this.connect();
        const pool = this.pool;
        await pool.query('START TRANSACTION');
        this.inTransaction = true;
        this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
    }
    async commitTransaction() {
        if (!this.inTransaction)
            throw new Error('No transaction in progress');
        const pool = this.pool;
        await pool.query('COMMIT');
        this.inTransaction = false;
        this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
    }
    async rollbackTransaction() {
        if (!this.inTransaction)
            throw new Error('No transaction in progress');
        const pool = this.pool;
        await pool.query('ROLLBACK');
        this.inTransaction = false;
        this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
    }
    /** Provide SQL dialect for this provider. */
    getDialect() {
        return new MysqlDialect();
    }
    /** Coerce arbitrary JS value into a valid SqlParameter for MySQL. */
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
    // DDL generation moved to MySqlDdlStrategy
    generateInsertSql(entity, metadata) {
        const insertable = metadata.columns.filter((c) => (!c.isGenerated || entity[c.propertyName] !== undefined) && !c.isComputed);
        const names = insertable.map((c) => c.columnName);
        const placeholders = insertable.map(() => '?');
        const params = insertable.map((c) => this.coerceToSqlParameter(entity[c.propertyName]));
        return {
            sql: `INSERT INTO ${metadata.tableName} (${names.join(', ')}) VALUES (${placeholders.join(', ')})`,
            params
        };
    }
    generateUpdateSql(entity, metadata, versionCol) {
        const updatable = metadata.columns.filter((c) => !metadata.primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed);
        const setClauses = updatable.map((c) => `${c.columnName} = ?`);
        const setParams = updatable.map((c) => this.coerceToSqlParameter(entity[c.propertyName]));
        if (versionCol)
            setClauses.push(`${versionCol.columnName} = ${versionCol.columnName} + 1`);
        const whereClauses = [];
        const whereParams = [];
        for (const pk of metadata.primaryKeys) {
            const col = metadata.columns.find((c) => c.propertyName === pk);
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
    generateDeleteSql(entity, metadata) {
        const whereClauses = [];
        const params = [];
        for (const pk of metadata.primaryKeys) {
            const col = metadata.columns.find((c) => c.propertyName === pk);
            whereClauses.push(`${col.columnName} = ?`);
            params.push(this.coerceToSqlParameter(entity[pk]));
        }
        const sql = `DELETE FROM ${metadata.tableName} WHERE ${whereClauses.join(' AND ')}`;
        return { sql, params };
    }
    mapRowToEntity(row, entityClass) {
        const entity = new entityClass();
        const metadata = MetadataStorage.getEntity(entityClass);
        if (metadata) {
            for (const column of metadata.columns) {
                if (Object.prototype.hasOwnProperty.call(row, column.columnName)) {
                    entity[column.propertyName] = row[column.columnName];
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
}
function mapTypeToMySql(type) {
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
function mapMySqlError(err) {
    const anyErr = err;
    const code = anyErr?.code;
    const message = anyErr?.message || String(err);
    if (code === 'ER_DUP_ENTRY')
        return new UniqueConstraintError(message, code);
    return new DatabaseError(message, code);
}
function safeRequireMysql2() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('mysql2/promise');
    }
    catch (e) {
        throw new Error('Package "mysql2" is required for MySqlProvider. Install it with: npm install mysql2');
    }
}
//# sourceMappingURL=MySqlProvider.js.map