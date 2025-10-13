"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MssqlProvider = void 0;
const core_1 = require("@ts-linq/core");
const dialect_mssql_1 = require("@ts-linq/dialect-mssql");
const PoolAdapter_1 = require("../mssql/PoolAdapter");
const ErrorMapper_1 = require("../mssql/ErrorMapper");
class MssqlProvider extends core_1.DatabaseProvider {
    constructor(connectionString, logger, middlewares, softDelete, retryPolicy) {
        super(connectionString, logger, middlewares, softDelete, retryPolicy);
        this.pool = null;
        this.tx = null;
        this.ddl = new (class DdlWrapper {
        })();
        this.providerName = 'mssql';
    }
    async connect() {
        if (this.isConnected)
            return;
        this.pool = (0, PoolAdapter_1.createMssqlPool)(this.connectionString);
        await this.pool.connect();
        this.isConnected = true;
    }
    async disconnect() {
        if (this.tx) {
            try {
                await this.tx.rollback();
            }
            catch {
                /* ignore */
            }
            this.tx = null;
        }
        if (this.pool) {
            try {
                await this.pool.close();
            }
            catch {
                /* ignore */
            }
            this.pool = null;
        }
        this.isConnected = false;
    }
    async createTable(entityMetadata) {
        const ddl = new (require('@ts-linq/dialect-mssql').MssqlDdlStrategy)();
        const sql = ddl.generateCreateTableSql(entityMetadata);
        await this.executeNonQuery(sql);
        for (const index of entityMetadata.indexes) {
            const idxSql = ddl.generateCreateIndexSql(entityMetadata.tableName, index);
            await this.executeNonQuery(idxSql);
        }
    }
    async insert(entity, entityClass) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const { sql, params, returningPk } = this.generateInsertSql(entity, metadata);
        const affected = await this.executeNonQuery(sql, params);
        if (affected > 0 && returningPk) {
            const rows = await this.executeQuery('SELECT CAST(SCOPE_IDENTITY() AS INT) AS id');
            const id = rows && rows[0]?.id;
            if (id !== undefined)
                entity[returningPk] = id;
        }
        return entity;
    }
    async update(entity, entityClass) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const versionCol = metadata.columns.find((c) => c.isVersion);
        const { sql, params } = this.generateUpdateSql(entity, metadata, versionCol);
        const affectedRows = await this.executeNonQuery(sql, params);
        if (affectedRows === 0) {
            if (versionCol)
                throw new core_1.OptimisticConcurrencyError();
            throw new Error('No rows were updated.');
        }
        if (versionCol) {
            const prop = versionCol.propertyName;
            const rec = entity;
            const cur = typeof rec[prop] === 'number' ? rec[prop] : Number(rec[prop] ?? 0);
            rec[prop] = cur + 1;
        }
        return entity;
    }
    async delete(entity, entityClass) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const { sql, params } = this.generateDeleteSql(entity, metadata);
        const affectedRows = await this.executeNonQuery(sql, params);
        if (affectedRows === 0)
            throw new Error('No rows were deleted.');
    }
    async upsert(entity, entityClass) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const pk = metadata.primaryKeys;
        if (!pk.length)
            return this.insert(entity, entityClass);
        const updatable = metadata.columns.filter((c) => !metadata.primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed);
        const sourceCols = metadata.columns.filter((c) => !c.isGenerated);
        const sourceSelect = sourceCols.map((c) => `? AS ${c.columnName}`).join(', ');
        const onClause = pk
            .map((k) => {
            const col = metadata.columns.find((c) => c.propertyName === k);
            return `t.${col.columnName} = s.${col.columnName}`;
        })
            .join(' AND ');
        const setClause = updatable.map((c) => `t.${c.columnName} = s.${c.columnName}`).join(', ');
        const insertCols = sourceCols.map((c) => c.columnName).join(', ');
        const insertVals = sourceCols.map((c) => `s.${c.columnName}`).join(', ');
        const params = sourceCols.map((c) => this.coerceToSqlParameter(entity[c.propertyName]));
        const sql = `MERGE ${metadata.tableName} AS t USING (SELECT ${sourceSelect}) AS s ON (${onClause}) ` +
            (setClause ? `WHEN MATCHED THEN UPDATE SET ${setClause} ` : '') +
            `WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals});`;
        await this.executeNonQuery(sql, params);
        return entity;
    }
    async findById(id, entityClass) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const pk = metadata.primaryKeys[0];
        if (!pk)
            throw new Error(`No primary key defined for ${entityClass.name}`);
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
        if (rows.length === 0)
            return null;
        return this.mapRowToEntity(rows[0], entityClass);
    }
    async findAll(entityClass) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
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
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const { whereClause, params } = core_1.SqlHelper.buildWhereClause(conditions);
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
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
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
        const rows = await this.executeQuery(sql, coerced);
        return rows.map((r) => this.mapRowToEntity(r, entityClass));
    }
    async doExecuteQuery(sql, params = []) {
        if (!this.isConnected)
            await this.connect();
        const { sql: mapped, params: mappedParams } = prepareMssqlSql(sql, params || []);
        const req = this.getRequest();
        mappedParams.forEach((v, i) => req.input(`p${i + 1}`, v));
        try {
            const result = await req.query(mapped);
            return result.recordset || [];
        }
        catch (e) {
            throw (0, ErrorMapper_1.mapMssqlError)(e);
        }
    }
    async doExecuteNonQuery(sql, params = []) {
        if (!this.isConnected)
            await this.connect();
        const { sql: mapped, params: mappedParams } = prepareMssqlSql(sql, params || []);
        const req = this.getRequest();
        mappedParams.forEach((v, i) => req.input(`p${i + 1}`, v));
        try {
            const result = await req.query(mapped);
            const rowsAffected = result.rowsAffected || [];
            return rowsAffected.reduce((sum, n) => sum + (n || 0), 0);
        }
        catch (e) {
            throw (0, ErrorMapper_1.mapMssqlError)(e);
        }
    }
    async beginTransaction() {
        if (!this.isConnected)
            await this.connect();
        const m = safeRequireMssql();
        this.tx = new m.Transaction(this.pool);
        await this.tx.begin();
        this.inTransaction = true;
        this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
    }
    async commitTransaction() {
        if (!this.inTransaction || !this.tx)
            throw new Error('No transaction in progress');
        await this.tx.commit();
        this.tx = null;
        this.inTransaction = false;
        this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
    }
    async rollbackTransaction() {
        if (!this.inTransaction || !this.tx)
            throw new Error('No transaction in progress');
        await this.tx.rollback();
        this.tx = null;
        this.inTransaction = false;
        this.logger?.transactionEnd?.({ traceId: this.currentTraceId, provider: this.providerName });
    }
    getDialect() {
        return new dialect_mssql_1.MssqlDialect();
    }
    getRequest() {
        const m = safeRequireMssql();
        const parent = (this.tx ?? this.pool);
        return new m.Request(parent);
    }
    generateInsertSql(entity, metadata) {
        const insertable = metadata.columns.filter((col) => !col.isGenerated || entity[col.propertyName] !== undefined);
        const columnNames = insertable.map((c) => c.columnName);
        const placeholders = insertable.map(() => '?');
        const params = insertable.map((c) => this.coerceToSqlParameter(entity[c.propertyName]));
        const sql = `INSERT INTO ${metadata.tableName} (${columnNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
        const firstPk = metadata.primaryKeys[0];
        const returningPk = firstPk && metadata.columns.find((c) => c.propertyName === firstPk)?.isGenerated
            ? firstPk
            : undefined;
        return { sql, params, returningPk };
    }
    generateUpdateSql(entity, metadata, versionCol) {
        const updatable = metadata.columns.filter((c) => !metadata.primaryKeys.includes(c.propertyName) && !c.isGenerated);
        if (updatable.length === 0)
            throw new Error(`No updatable columns for ${metadata.target.name}`);
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
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
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
}
exports.MssqlProvider = MssqlProvider;
function prepareMssqlSql(sql, params) {
    if (!params || params.length === 0)
        return { sql, params: [] };
    let index = 0;
    const mapped = sql.replace(/\?/g, () => `@p${++index}`);
    return { sql: mapped, params: [...params] };
}
function safeRequireMssql() {
    try {
        return require('mssql');
    }
    catch (e) {
        throw new Error('Package "mssql" is required for MssqlProvider. Install it with: npm install mssql');
    }
}
//# sourceMappingURL=MssqlProvider.js.map