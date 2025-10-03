"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresProvider = void 0;
const core_1 = require("@ts-linq/core");
const dialect_postgres_1 = require("@ts-linq/dialect-postgres");
const dialect_postgres_2 = require("@ts-linq/dialect-postgres");
const PoolAdapter_1 = require("../pg/PoolAdapter");
const ErrorMapper_1 = require("../pg/ErrorMapper");
class PostgresProvider extends core_1.DatabaseProvider {
    mapRowToEntity(row, entityClass) {
        const entity = new entityClass();
        const meta = core_1.MetadataStorage.getEntity(entityClass);
        if (meta) {
            for (const col of meta.columns) {
                if (Object.prototype.hasOwnProperty.call(row, col.columnName)) {
                    entity[col.propertyName] = convertValueFromPg(row[col.columnName], col.type);
                }
            }
        }
        else {
            Object.assign(entity, row);
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.notifyEntityMaterialized(entity, meta);
        return entity;
    }
    constructor(connectionString, logger, middlewares, softDelete, retryPolicy) {
        super(connectionString, logger, middlewares, softDelete, retryPolicy);
        this.ddl = new dialect_postgres_2.PostgresDdlStrategy();
        this.qb = new core_1.QueryBuilder(this.getDialect());
        this.providerName = 'postgresql';
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
    async connect() {
        this.pool = (0, PoolAdapter_1.createPgPool)(this.connectionString);
        this.isConnected = true;
    }
    async disconnect() {
        if (this.pool)
            await this.pool.end();
        this.isConnected = false;
    }
    async createTable(entityMetadata) {
        const sql = this.ddl.generateCreateTableSql(entityMetadata);
        await this.executeNonQuery(sql);
        for (const index of entityMetadata.indexes) {
            const idxSql = this.ddl.generateCreateIndexSql(entityMetadata.tableName, index);
            await this.executeNonQuery(idxSql);
        }
    }
    async insert(entity, entityClass) {
        const meta = core_1.MetadataStorage.getEntity(entityClass);
        if (!meta)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const cols = meta.columns.filter((c) => !c.isGenerated && !c.isComputed);
        const names = cols.map((c) => `"${c.columnName}"`);
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const values = cols.map((c) => this.coerceToSqlParameter(convertValueForPg(entity[c.propertyName], c.type)));
        const sql = `INSERT INTO "${meta.tableName}" (${names.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
        const rows = await this.executeQuery(sql, values);
        Object.assign(entity, rows[0]);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.notifyEntityMaterialized(entity, meta);
        return entity;
    }
    async update(entity, entityClass) {
        const meta = core_1.MetadataStorage.getEntity(entityClass);
        if (!meta)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const versionCol = meta.columns.find((c) => c.isVersion);
        const setCols = meta.columns.filter((c) => !meta.primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed);
        if (setCols.length === 0)
            return entity;
        const sets = setCols.map((c, i) => `"${c.columnName}" = $${i + 1}`);
        const setVals = setCols.map((c) => this.coerceToSqlParameter(convertValueForPg(entity[c.propertyName], c.type)));
        if (versionCol) {
            sets.push(`"${versionCol.columnName}" = "${versionCol.columnName}" + 1`);
        }
        const where = meta.primaryKeys.map((pk, i) => `"${meta.columns.find((c) => c.propertyName === pk)?.columnName || pk}" = $${setCols.length + i + 1}`);
        const whereVals = meta.primaryKeys.map((pk) => this.coerceToSqlParameter(entity[pk]));
        let sql = `UPDATE "${meta.tableName}" SET ${sets.join(', ')} WHERE ${where.join(' AND ')}`;
        if (versionCol) {
            sql += ` AND "${versionCol.columnName}" = $${setCols.length + meta.primaryKeys.length + 1}`;
            whereVals.push(this.coerceToSqlParameter(entity[versionCol.propertyName]));
        }
        const affected = await this.executeNonQuery(sql, [...setVals, ...whereVals]);
        if (affected === 0) {
            if (versionCol)
                throw new core_1.OptimisticConcurrencyError();
            throw new Error('No rows were updated. Not found or no changes.');
        }
        if (versionCol) {
            const prop = versionCol.propertyName;
            const rec = entity;
            const cur = typeof rec[prop] === 'number' ? rec[prop] : Number(rec[prop] ?? 0);
            rec[prop] = cur + 1;
        }
        return entity;
    }
    async upsert(entity, entityClass) {
        const meta = core_1.MetadataStorage.getEntity(entityClass);
        if (!meta)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        if (!meta.primaryKeys || meta.primaryKeys.length === 0) {
            return this.insert(entity, entityClass);
        }
        const insertCols = meta.columns.filter((c) => !c.isGenerated && !c.isComputed);
        const names = insertCols.map((c) => `"${c.columnName}"`);
        const placeholders = insertCols.map((_, i) => `$${i + 1}`);
        const values = insertCols.map((c) => this.coerceToSqlParameter(convertValueForPg(entity[c.propertyName], c.type)));
        const conflictTargets = meta.primaryKeys
            .map((pk) => `"${meta.columns.find((c) => c.propertyName === pk)?.columnName || pk}"`)
            .join(', ');
        const setCols = meta.columns.filter((c) => !meta.primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed);
        const setClause = setCols
            .map((c) => `"${c.columnName}" = EXCLUDED."${c.columnName}"`)
            .join(', ');
        const sql = `INSERT INTO "${meta.tableName}" (${names.join(',')}) VALUES (${placeholders.join(',')}) ON CONFLICT (${conflictTargets}) DO UPDATE SET ${setClause} RETURNING *`;
        const rows = await this.executeQuery(sql, values);
        if (rows[0])
            Object.assign(entity, rows[0]);
        return entity;
    }
    async delete(entity, entityClass) {
        const meta = core_1.MetadataStorage.getEntity(entityClass);
        if (!meta)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const where = meta.primaryKeys.map((pk, i) => `"${meta.columns.find((c) => c.propertyName === pk)?.columnName || pk}" = $${i + 1}`);
        const vals = meta.primaryKeys.map((pk) => this.coerceToSqlParameter(entity[pk]));
        const sql = `DELETE FROM "${meta.tableName}" WHERE ${where.join(' AND ')}`;
        await this.executeNonQuery(sql, vals);
    }
    getDialect() {
        return new dialect_postgres_1.PostgresDialect();
    }
    async findById(id, entityClass) {
        const meta = core_1.MetadataStorage.getEntity(entityClass);
        if (!meta)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const pk = meta.primaryKeys[0];
        const col = meta.columns.find((c) => c.propertyName === pk)?.columnName || pk;
        let sql = `SELECT * FROM "${meta.tableName}" WHERE "${col}" = $1`;
        if (this.softDelete?.enabled) {
            const flag = this.softDelete.column ?? 'isDeleted';
            const has = meta.columns.some((c) => c.propertyName === flag || c.columnName === flag);
            if (has)
                sql += ` AND "${flag}" = FALSE`;
        }
        const rows = await this.executeQuery(sql, [
            this.coerceToSqlParameter(id)
        ]);
        const firstRow = rows[0];
        if (!firstRow)
            return null;
        const entity = this.mapRowToEntity(firstRow, entityClass);
        return entity;
    }
    async findAll(entityClass) {
        const meta = core_1.MetadataStorage.getEntity(entityClass);
        if (!meta)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        let sql = `SELECT * FROM "${meta.tableName}"`;
        if (this.softDelete?.enabled) {
            const flag = this.softDelete.column ?? 'isDeleted';
            const has = meta.columns.some((c) => c.propertyName === flag || c.columnName === flag);
            if (has)
                sql += ` WHERE "${flag}" = FALSE`;
        }
        const rows = await this.executeQuery(sql);
        return rows.map((r) => this.mapRowToEntity(r, entityClass));
    }
    async findWhere(entityClass, conditions) {
        const meta = core_1.MetadataStorage.getEntity(entityClass);
        if (!meta)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const keys = Object.keys(conditions);
        const clauses = keys.map((k, i) => `"${meta.columns.find((c) => c.propertyName === k || c.columnName === k)?.columnName || k}" = $${i + 1}`);
        const vals = keys.map((k) => this.coerceToSqlParameter(conditions[k]));
        let sql = `SELECT * FROM "${meta.tableName}" WHERE ${clauses.join(' AND ')}`;
        if (this.softDelete?.enabled) {
            const flag = this.softDelete.column ?? 'isDeleted';
            const has = meta.columns.some((c) => c.propertyName === flag || c.columnName === flag);
            if (has)
                sql += ` AND "${flag}" = FALSE`;
        }
        const rows = await this.executeQuery(sql, vals);
        return rows.map((r) => this.mapRowToEntity(r, entityClass));
    }
    async findWhereIn(entityClass, column, values) {
        if (!values || values.length === 0)
            return [];
        const meta = core_1.MetadataStorage.getEntity(entityClass);
        if (!meta)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const col = meta.columns.find((c) => c.propertyName === column || c.columnName === column)?.columnName ||
            column;
        let sql = `SELECT * FROM "${meta.tableName}" WHERE "${col}" = ANY($1)`;
        if (this.softDelete?.enabled) {
            const flag = this.softDelete.column ?? 'isDeleted';
            const has = meta.columns.some((c) => c.propertyName === flag || c.columnName === flag);
            if (has)
                sql += ` AND "${flag}" = FALSE`;
        }
        const rows = await this.executeQuery(sql, [
            values
        ]);
        return rows.map((r) => this.mapRowToEntity(r, entityClass));
    }
    async doExecuteQuery(sql, params = []) {
        try {
            const res = await this.pool.query(sql, params);
            return res.rows;
        }
        catch (e) {
            throw (0, ErrorMapper_1.mapPgError)(e);
        }
    }
    async doExecuteNonQuery(sql, params = []) {
        try {
            const res = await this.pool.query(sql, params);
            return res.rowCount;
        }
        catch (e) {
            throw (0, ErrorMapper_1.mapPgError)(e);
        }
    }
    async beginTransaction() {
        if (this.inTransaction)
            throw new Error('Transaction already in progress');
        this.currentTraceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        await this.executeNonQuery('BEGIN');
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
}
exports.PostgresProvider = PostgresProvider;
function convertValueForPg(value, type) {
    if (value === null || value === undefined)
        return value;
    switch (type.toUpperCase()) {
        case 'JSON':
        case 'JSONB':
            return typeof value === 'string' ? value : JSON.stringify(value);
        default:
            return value;
    }
}
function convertValueFromPg(value, type) {
    if (value === null || value === undefined)
        return value;
    switch (type.toUpperCase()) {
        case 'BOOLEAN':
            return Boolean(value);
        case 'INTEGER':
        case 'NUMBER':
            return typeof value === 'number' ? value : Number(value);
        case 'TIMESTAMPTZ':
        case 'DATETIME':
        case 'DATE':
            return value instanceof Date ? value : new Date(value);
        case 'JSONB':
        case 'JSON':
            return typeof value === 'string' ? JSON.parse(value) : value;
        default:
            return value;
    }
}
//# sourceMappingURL=PostgresProvider.js.map