"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderStub = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
const DatabaseProvider_1 = require("../../src/DatabaseProvider");
const MetadataStorage_1 = require("../../src/metadata/MetadataStorage");
class TestDialect {
    buildSelect(entityClass, options) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        let query = `SELECT ${options.distinct ? 'DISTINCT ' : ''}${options.select?.length ? options.select.join(', ') : '*'} FROM ${meta.tableName}`;
        const parameters = [];
        if (options.where && options.where.length) {
            query += ' WHERE ' + options.where.map((w) => w.condition).join(' AND ');
            for (const w of options.where)
                parameters.push(...w.parameters);
        }
        if (options.orderBy && options.orderBy.length) {
            query += ' ORDER BY ' + options.orderBy.map((o) => `${o.column} ${o.direction}`).join(', ');
        }
        const hasLimit = options.limit !== undefined && options.limit !== null;
        const hasOffset = options.offset !== undefined && options.offset !== null;
        if (hasLimit) {
            query += ` LIMIT ${options.limit}`;
            if (hasOffset)
                query += ` OFFSET ${options.offset}`;
        }
        else if (hasOffset) {
            query += ` LIMIT -1 OFFSET ${options.offset}`;
        }
        return { query, parameters };
    }
}
class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
    constructor(connectionString, logger, middlewares, softDelete, retryPolicy) {
        super(connectionString, logger, middlewares, softDelete, retryPolicy);
        this.data = new Map();
        this.seq = new Map();
        this.dialect = new TestDialect();
        this.providerName = 'sqlite';
    }
    async connect() {
        this.isConnected = true;
    }
    async disconnect() {
        this.isConnected = false;
    }
    async createTable(entityMetadata) {
        await this.beforeExecute(`CREATE TABLE ${entityMetadata.tableName}`, []);
        if (!this.data.has(entityMetadata.tableName)) {
            this.data.set(entityMetadata.tableName, []);
            this.seq.set(entityMetadata.tableName, 0);
        }
        await this.afterExecute(`CREATE TABLE ${entityMetadata.tableName}`, [], 0);
    }
    getDialect() {
        return this.dialect;
    }
    async insert(entity, entityClass) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        await this.beforeExecute(`INSERT INTO ${meta.tableName}`, []);
        await this.ensureTable(meta);
        const table = this.data.get(meta.tableName);
        const rec = {};
        for (const col of meta.columns) {
            const val = entity[col.propertyName];
            if (val !== undefined)
                rec[col.columnName] = val;
        }
        // Fallback: also copy plain enumerable props by property name
        for (const [k, v] of Object.entries(entity)) {
            if (rec[k] === undefined)
                rec[k] = v;
        }
        // auto-increment primary key
        if (meta.primaryKeys.length > 0) {
            const pk = meta.primaryKeys[0];
            const pkCol = meta.columns.find((c) => c.propertyName === pk);
            if (pkCol?.isGenerated &&
                (rec[pkCol.columnName] === undefined || rec[pkCol.columnName] === null)) {
                const next = this.seq.get(meta.tableName) + 1;
                this.seq.set(meta.tableName, next);
                rec[pkCol.columnName] = next;
                entity[pk] = next;
            }
        }
        table.push(rec);
        await this.afterExecute(`INSERT INTO ${meta.tableName}`, [], 1);
        return entity;
    }
    async update(entity, entityClass) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        await this.beforeExecute(`UPDATE ${meta.tableName}`, []);
        const table = this.data.get(meta.tableName) || [];
        const pk = meta.primaryKeys[0];
        const pkCol = meta.columns.find((c) => c.propertyName === pk);
        const pkName = pkCol?.columnName ?? pk;
        const idx = table.findIndex((r) => r[pkName] === entity[pk]);
        const targetIdx = idx >= 0 ? idx : table.length > 0 ? table.length - 1 : -1;
        if (targetIdx >= 0) {
            const row = table[targetIdx];
            for (const col of meta.columns) {
                if (col.propertyName === pk)
                    continue;
                const val = entity[col.propertyName];
                if (val !== undefined)
                    row[col.columnName] = val;
            }
            // audit updatedAt
            const updatedAtCol = meta.columns.find((c) => c.columnName === 'updatedAt');
            if (updatedAtCol)
                row['updatedAt'] = new Date();
            // Fallback: copy other enumerable props
            for (const [k, v] of Object.entries(entity)) {
                if (row[k] === undefined && k !== pk)
                    row[k] = v;
            }
            this.data.set(meta.tableName, table);
            await this.afterExecute(`UPDATE ${meta.tableName}`, [], 1);
            return entity;
        }
        await this.afterExecute(`UPDATE ${meta.tableName}`, [], 0);
        throw new Error('No rows were updated.');
    }
    async delete(entity, entityClass) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        await this.beforeExecute(`DELETE FROM ${meta.tableName}`, []);
        const table = this.data.get(meta.tableName) || [];
        const pk = meta.primaryKeys[0];
        const pkCol = meta.columns.find((c) => c.propertyName === pk);
        const pkName = pkCol?.columnName ?? pk;
        const idx = table.findIndex((r) => r[pkName] === entity[pk]);
        if (idx >= 0) {
            const sd = this.softDelete;
            if (sd?.enabled) {
                // soft delete: mark flag and timestamp
                const row = table[idx];
                row[sd.column] = true;
                if (sd.deletedAtColumn)
                    row[sd.deletedAtColumn] = new Date();
                await this.afterExecute(`UPDATE ${meta.tableName} /* soft-delete */`, [], 1);
            }
            else {
                table.splice(idx, 1);
                await this.afterExecute(`DELETE FROM ${meta.tableName}`, [], 1);
            }
            return;
        }
        await this.afterExecute(`DELETE FROM ${meta.tableName}`, [], 0);
        throw new Error('No rows were deleted.');
    }
    async findById(id, entityClass) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        await this.beforeExecute(`SELECT * FROM ${meta.tableName} WHERE id = ?`, [id]);
        const table = this.data.get(meta.tableName) || [];
        const pk = meta.primaryKeys[0];
        const pkCol = meta.columns.find((c) => c.propertyName === pk);
        const pkName = pkCol?.columnName ?? pk;
        let row = table.find((r) => r[pkName] === id);
        if (this.softDelete?.enabled && this.softDelete.column && row && row[this.softDelete.column]) {
            row = undefined;
        }
        const ent = row ? this.materialize(entityClass, row) : null;
        await this.afterExecute(`SELECT * FROM ${meta.tableName} WHERE id = ?`, [id], ent ? 1 : 0);
        return ent;
    }
    async findAll(entityClass) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        await this.beforeExecute(`SELECT * FROM ${meta.tableName}`, []);
        const table = (this.data.get(meta.tableName) || []).slice();
        const pk = meta.primaryKeys[0];
        const pkCol = meta.columns.find((c) => c.propertyName === pk);
        const pkName = pkCol?.columnName ?? pk;
        // apply soft-delete filter if configured
        let rows = table;
        if (this.softDelete?.enabled && this.softDelete.column) {
            rows = rows.filter((r) => !r[this.softDelete.column]);
        }
        rows.sort((a, b) => (a[pkName] ?? 0) - (b[pkName] ?? 0));
        const res = rows.map((r) => this.materialize(entityClass, r));
        await this.afterExecute(`SELECT * FROM ${meta.tableName}`, [], res.length);
        return res;
    }
    async findWhere(entityClass, conditions) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        const params = Object.values(conditions);
        await this.beforeExecute(`SELECT * FROM ${meta.tableName} WHERE ...`, params);
        const table = (this.data.get(meta.tableName) || []).slice();
        const entries = Object.entries(conditions);
        let rows = table;
        if (this.softDelete?.enabled && this.softDelete.column) {
            rows = rows.filter((r) => !r[this.softDelete.column]);
        }
        const res = rows
            .filter((r) => entries.every(([k, v]) => r[k] === v))
            .map((r) => this.materialize(entityClass, r));
        await this.afterExecute(`SELECT * FROM ${meta.tableName} WHERE ...`, params, res.length);
        return res;
    }
    async findWhereIn(entityClass, column, values) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        await this.beforeExecute(`SELECT * FROM ${meta.tableName} WHERE ${column} IN (?)`, values);
        const table = this.data.get(meta.tableName) || [];
        const colName = column;
        const set = new Set(values);
        const res = table
            .filter((r) => set.has(r[colName]))
            .map((r) => this.materialize(entityClass, r));
        await this.afterExecute(`SELECT * FROM ${meta.tableName} WHERE ${column} IN (?)`, values, res.length);
        return res;
    }
    async doExecuteQuery(sql, params = []) {
        const startedAt = Date.now();
        if (!this.currentTraceId)
            this.currentTraceId = Math.random().toString(36).slice(2);
        this.loggerRef?.queryStart?.({ sql, params, provider: this.providerLabel });
        // Handle UNION / UNION ALL by splitting and executing parts, then merging
        const unionMatch = sql.toUpperCase().includes('UNION');
        if (unionMatch) {
            const parts = sql.replace(/\s+/g, ' ').split(/\s+UNION\s+ALL\s+|\s+UNION\s+/i);
            const isUnionAll = /UNION\s+ALL/i.test(sql);
            let combined = [];
            let offset = 0;
            for (const part of parts) {
                const phCount = (part.match(/\?/g) || []).length;
                const slice = params.slice(offset, offset + phCount);
                offset += phCount;
                const rows = (await this.doExecuteQuery(part, slice));
                if (isUnionAll) {
                    combined = combined.concat(rows);
                }
                else {
                    const seen = new Set(combined.map((r) => JSON.stringify(r)));
                    for (const r of rows) {
                        const key = JSON.stringify(r);
                        if (!seen.has(key)) {
                            combined.push(r);
                            seen.add(key);
                        }
                    }
                }
            }
            const durationMs = Date.now() - startedAt;
            this.loggerRef?.queryEnd?.({
                sql,
                params,
                durationMs,
                rows: combined.length,
                provider: this.providerLabel
            });
            return combined;
        }
        // Very small SQL subset: SELECT * FROM <table> [WHERE <col> = ?] [ORDER BY <col> ASC|DESC] [LIMIT N [OFFSET M]]
        // SQLite schema inspection PRAGMAs and sqlite_master
        if (/^\s*PRAGMA\s+table_info\(([^)]+)\)/i.test(sql)) {
            const t = /^\s*PRAGMA\s+table_info\(([^)]+)\)/i.exec(sql)[1];
            const table = this.data.get(t) || [];
            const cols = Object.keys(table[0] || {}).map((name, idx) => ({
                name,
                type: typeof (table[0] || {})[name] === 'number' ? 'INTEGER' : 'TEXT',
                notnull: false,
                dflt_value: null,
                pk: name === 'id' ? 1 : 0
            }));
            const durationMs = Date.now() - startedAt;
            this.loggerRef?.queryEnd?.({
                sql,
                params,
                durationMs,
                rows: cols.length,
                provider: this.providerLabel
            });
            return cols;
        }
        if (/^\s*PRAGMA\s+index_list\(([^)]+)\)/i.test(sql)) {
            const durationMs = Date.now() - startedAt;
            this.loggerRef?.queryEnd?.({
                sql,
                params,
                durationMs,
                rows: 0,
                provider: this.providerLabel
            });
            return [];
        }
        if (/^\s*PRAGMA\s+index_info\(([^)]+)\)/i.test(sql)) {
            const durationMs = Date.now() - startedAt;
            this.loggerRef?.queryEnd?.({
                sql,
                params,
                durationMs,
                rows: 0,
                provider: this.providerLabel
            });
            return [];
        }
        if (/SELECT\s+name\s+FROM\s+sqlite_master/i.test(sql)) {
            const names = Array.from(this.data.keys()).map((name) => ({ name }));
            const durationMs = Date.now() - startedAt;
            this.loggerRef?.queryEnd?.({
                sql,
                params,
                durationMs,
                rows: names.length,
                provider: this.providerLabel
            });
            return names;
        }
        const mFrom = /FROM\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(sql);
        if (!mFrom)
            return [];
        const tableName = mFrom[1];
        let rows = (this.data.get(tableName) || []).slice();
        if (this.softDelete?.enabled && this.softDelete.column) {
            // Всегда скрываем мягко удалённые строки для простоты юнит-тестов
            rows = rows.filter((r) => !r[this.softDelete.column]);
        }
        const whereEq = /WHERE\s+([A-Za-z_"\[\]]+)\s*=\s*\?/i.exec(sql);
        if (whereEq) {
            const col = whereEq[1].replace(/^["\[]|["\]]$/g, '');
            const val = params[0];
            rows = rows.filter((r) => r[col] === val);
        }
        else {
            // WHERE <col> = <number|boolean>
            const whereEqLit = /WHERE\s+([A-Za-z_"\[\]]+)\s*=\s*(\d+|true|false)/i.exec(sql);
            if (whereEqLit) {
                const col = whereEqLit[1].replace(/^["\[]|["\]]$/g, '');
                const lit = whereEqLit[2];
                const val = /true|false/i.test(lit) ? /true/i.test(lit) : Number(lit);
                rows = rows.filter((r) => r[col] === val);
            }
            const whereGt = /WHERE\s+([A-Za-z_][A-Za-z0-9_]*)\s*>\s*\?/i.exec(sql);
            if (whereGt) {
                const col = whereGt[1];
                const val = params[0];
                rows = rows.filter((r) => r[col] > val);
            }
            const inMatch = /WHERE\s+([A-Za-z_][A-Za-z0-9_]*)\s+IN\s*\(([^)]+)\)/i.exec(sql);
            if (inMatch) {
                const col = inMatch[1];
                // Support IN with parameters or simple subquery: IN (SELECT col FROM Other)
                if (/^\s*SELECT\s+/i.test(inMatch[2])) {
                    const sub = inMatch[2];
                    const mSub = /SELECT\s+([A-Za-z_][A-Za-z0-9_]*)\s+FROM\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(sub);
                    if (mSub) {
                        const subCol = mSub[1];
                        const subTable = mSub[2];
                        const subRows = (this.data.get(subTable) || []).slice();
                        const set = new Set(subRows.map((r) => r[subCol]));
                        rows = rows.filter((r) => set.has(r[col]));
                    }
                }
                else {
                    const set = new Set(params);
                    rows = rows.filter((r) => set.has(r[col]));
                }
            }
        }
        const orderMatch = /ORDER\s+BY\s+([A-Za-z_][A-Za-z0-9_]*)\s+(ASC|DESC)/i.exec(sql);
        if (orderMatch) {
            const col = orderMatch[1];
            const dir = orderMatch[2].toUpperCase();
            rows.sort((a, b) => (a[col] === b[col] ? 0 : a[col] < b[col] ? -1 : 1));
            if (dir === 'DESC')
                rows.reverse();
        }
        const mLimit = /LIMIT\s+(-?\d+)/i.exec(sql);
        const mOffset = /OFFSET\s+(\d+)/i.exec(sql);
        if (mOffset)
            rows = rows.slice(Number(mOffset[1]));
        if (mLimit) {
            const n = Number(mLimit[1]);
            if (n >= 0)
                rows = rows.slice(0, n);
        }
        // COUNT(*) support
        const isCount = /SELECT\s+COUNT\(\*\)\s+AS\s+count/i.test(sql);
        const result = isCount
            ? [{ count: rows.length }]
            : rows;
        const durationMs = Date.now() - startedAt;
        this.loggerRef?.queryEnd?.({
            sql,
            params,
            durationMs,
            rows: result.length,
            provider: this.providerLabel
        });
        return result;
    }
    async doExecuteNonQuery(sql, _params = []) {
        const startedAt = Date.now();
        if (!this.currentTraceId)
            this.currentTraceId = Math.random().toString(36).slice(2);
        this.loggerRef?.queryStart?.({ sql, params: _params, provider: this.providerLabel });
        const del = /^\s*DELETE\s+FROM\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(sql);
        if (del) {
            const tableName = del[1];
            const n = (this.data.get(tableName) || []).length;
            this.data.set(tableName, []);
            this.seq.set(tableName, 0);
            const durationMs = Date.now() - startedAt;
            this.loggerRef?.queryEnd?.({
                sql,
                params: _params,
                durationMs,
                rows: n,
                provider: this.providerLabel
            });
            return n;
        }
        const durationMs = Date.now() - startedAt;
        this.loggerRef?.queryEnd?.({
            sql,
            params: _params,
            durationMs,
            rows: 0,
            provider: this.providerLabel
        });
        return 0;
    }
    async beginTransaction() {
        // snapshot
        this.currentTraceId = Math.random().toString(36).slice(2);
        const dataCopy = new Map();
        for (const [k, v] of this.data.entries())
            dataCopy.set(k, v.map((x) => ({ ...x })));
        const seqCopy = new Map();
        for (const [k, v] of this.seq.entries())
            seqCopy.set(k, v);
        this.txBackup = { data: dataCopy, seq: seqCopy };
    }
    async commitTransaction() {
        this.txBackup = undefined;
        this.currentTraceId = undefined;
    }
    async rollbackTransaction() {
        if (this.txBackup) {
            this.data.clear();
            for (const [k, v] of this.txBackup.data.entries())
                this.data.set(k, v.map((x) => ({ ...x })));
            this.seq.clear();
            for (const [k, v] of this.txBackup.seq.entries())
                this.seq.set(k, v);
            this.txBackup = undefined;
        }
        this.currentTraceId = undefined;
    }
    async ensureTable(meta) {
        if (!this.data.has(meta.tableName))
            await this.createTable(meta);
    }
    materialize(ctor, row) {
        const entity = new ctor();
        const meta = MetadataStorage_1.MetadataStorage.getEntity(ctor);
        if (meta) {
            for (const c of meta.columns) {
                const v = row[c.columnName];
                if (v !== undefined)
                    entity[c.propertyName] = v;
            }
            // Fallback: copy any remaining fields if not set by metadata
            for (const [k, v] of Object.entries(row)) {
                if (entity[k] === undefined)
                    entity[k] = v;
            }
            // notify middleware about materialization
            void this.notifyEntityMaterialized(entity, meta);
        }
        else {
            Object.assign(entity, row);
        }
        return entity;
    }
}
exports.ProviderStub = ProviderStub;
//# sourceMappingURL=ProviderStub.js.map