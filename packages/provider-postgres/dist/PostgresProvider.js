"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresProvider = void 0;
const core_1 = require("@ts-linq/core");
const dialect_postgres_1 = require("@ts-linq/dialect-postgres");
const dialect_postgres_2 = require("@ts-linq/dialect-postgres");
// Lazy require to avoid hard dependency if not installed
let Pg;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Pg = require('pg');
}
catch (e) {
    try {
        const { warnIfLoggerDebug } = require('../utils/MetricsSafe');
        warnIfLoggerDebug('require(pg)', e);
    }
    catch {
        /* ignore */
    }
}
/**
 * PostgreSQL provider backed by `pg` Pool.
 *
 * Responsibilities:
 * - Connection lifecycle and transaction control
 * - DDL for simple table/index creation (prefer migrations for production)
 * - CRUD helpers using parameterized SQL ($1..$n)
 * - Convenience findWhere/findWhereIn APIs
 * - Basic value conversions for common types (JSON/JSONB/TIMESTAMPTZ)
 */
class PostgresProvider extends core_1.DatabaseProvider {
    /** Map a row object to a new entity instance using entity metadata and notify middleware. */
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
    constructor(connectionString, logger, middlewares, softDelete, retryPolicy, poolOptions, healthCheck) {
        super(connectionString, logger, middlewares, softDelete, retryPolicy, poolOptions, healthCheck);
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
    /** Open a connection pool to PostgreSQL using the connection string. */
    async connect() {
        if (!Pg)
            throw new Error('pg module is not installed');
        const { Pool } = Pg;
        const poolOpts = this.poolOptions || {};
        // Map generic pool options to pg.Pool config when available
        const pgConfig = { connectionString: this.connectionString };
        if (typeof poolOpts.max === 'number')
            pgConfig.max = poolOpts.max;
        if (typeof poolOpts.idleTimeoutMs === 'number')
            pgConfig.idleTimeoutMillis = poolOpts.idleTimeoutMs;
        if (typeof poolOpts.connectionTimeoutMs === 'number')
            pgConfig.connectionTimeoutMillis = poolOpts.connectionTimeoutMs;
        this.pool = new Pool(pgConfig);
        this.isConnected = true;
        // Start health checks if enabled
        await (async () => {
            // ensure at least one awaited async in connect() for lint rule
            /* noop */
        })();
        this.startHealthChecks(async () => {
            const started = Date.now();
            const sql = this.healthCheck?.testQuery || 'SELECT 1';
            await this.pool.query(sql);
            return Date.now() - started;
        });
    }
    /** Gracefully dispose of the connection pool. */
    async disconnect() {
        this.stopHealthChecks();
        if (this.pool)
            await this.pool.end();
        this.isConnected = false;
    }
    /**
     * Create a table for the given entity metadata when it does not exist.
     * Also ensures declared indexes exist. For complex schemas prefer migrations.
     */
    async createTable(entityMetadata) {
        const sql = this.ddl.generateCreateTableSql(entityMetadata);
        await this.executeNonQuery(sql);
        // Create indexes
        for (const index of entityMetadata.indexes) {
            const idxSql = this.ddl.generateCreateIndexSql(entityMetadata.tableName, index);
            await this.executeNonQuery(idxSql);
        }
    }
    /** Insert an entity row and return the populated entity (RETURNING *). */
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
        // notify materialized of inserted row state
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.notifyEntityMaterialized(entity, meta);
        return entity;
    }
    /** Update a row by primary key; supports optimistic concurrency via version column. */
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
    /** Upsert using INSERT ... ON CONFLICT (pk...) DO UPDATE SET ... RETURNING *. */
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
    /** Delete a row by primary key. */
    async delete(entity, entityClass) {
        const meta = core_1.MetadataStorage.getEntity(entityClass);
        if (!meta)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const where = meta.primaryKeys.map((pk, i) => `"${meta.columns.find((c) => c.propertyName === pk)?.columnName || pk}" = $${i + 1}`);
        const vals = meta.primaryKeys.map((pk) => this.coerceToSqlParameter(entity[pk]));
        const sql = `DELETE FROM "${meta.tableName}" WHERE ${where.join(' AND ')}`;
        await this.executeNonQuery(sql, vals);
    }
    /** Provide SQL dialect for this provider. */
    getDialect() {
        return new dialect_postgres_1.PostgresDialect();
    }
    /** Fetch a single row by its primary key value. */
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
    /** Fetch all rows for the given entity type. */
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
    /** Find rows by simple equality conditions { column: value }. */
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
    /** Find rows where a column equals any of provided values using Postgres ANY($1). */
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
    /** Low-level query execution returning rows. */
    async doExecuteQuery(sql, params = []) {
        try {
            const res = await this.pool.query(sql, params);
            return res.rows;
        }
        catch (e) {
            throw mapPgError(e);
        }
    }
    /** Low-level non-query execution returning rowCount. */
    async doExecuteNonQuery(sql, params = []) {
        try {
            const res = await this.pool.query(sql, params);
            return res.rowCount;
        }
        catch (e) {
            throw mapPgError(e);
        }
    }
    /** Obtain PostgreSQL EXPLAIN (FORMAT JSON) plan when possible. */
    async getExplainPlan(sql, params) {
        try {
            const explainSql = `EXPLAIN (FORMAT JSON) ${sql}`;
            const rows = await this.doExecuteQuery(explainSql, params);
            const first = rows && rows[0];
            if (!first)
                return undefined;
            // Typical shape: { 'QUERY PLAN': [ { Plan: {...} } ] }
            const key = Object.keys(first).find((k) => k.toUpperCase().includes('QUERY PLAN'));
            return key ? first[key] : first;
        }
        catch {
            return undefined;
        }
    }
    /** Begin a transaction (sets a trace id for logging). */
    async beginTransaction() {
        if (this.inTransaction)
            throw new Error('Transaction already in progress');
        this.currentTraceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        await this.executeNonQuery('BEGIN');
        this.inTransaction = true;
        this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
    }
    /** Commit the current transaction. */
    async commitTransaction() {
        if (!this.inTransaction)
            throw new Error('No transaction in progress');
        await this.executeNonQuery('COMMIT');
        this.inTransaction = false;
        const tid = this.currentTraceId;
        this.currentTraceId = undefined;
        this.logger?.transactionEnd?.({ traceId: tid, provider: this.providerName });
    }
    /** Roll back the current transaction. */
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
/** Map logical column type to PostgreSQL type name. */
function mapTypeToPg(type) {
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
            return 'DOUBLE PRECISION';
        case 'BOOLEAN':
            return 'BOOLEAN';
        case 'DATETIME':
        case 'DATE':
            return 'TIMESTAMPTZ';
        case 'BLOB':
            return 'BYTEA';
        case 'UUID':
            return 'UUID';
        case 'JSONB':
            return 'JSONB';
        case 'JSON':
            return 'JSON';
        default:
            return 'TEXT';
    }
}
/** Convert JS value to a PostgreSQL parameter according to column type. */
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
/** Convert PostgreSQL value to a JS runtime value according to mapped type. */
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
function mapPgError(err) {
    const anyErr = err;
    const code = anyErr?.code;
    const message = anyErr?.message || String(err);
    if (code === '23505')
        return new core_1.UniqueConstraintError(message, code);
    if (code === '23503')
        return new core_1.ForeignKeyConstraintError(message, code);
    return new core_1.DatabaseError(message, code);
}
// (removed legacy free function mapRowToEntity; instance method is used)
//# sourceMappingURL=PostgresProvider.js.map