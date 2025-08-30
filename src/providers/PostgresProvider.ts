import { DatabaseProvider } from './DatabaseProvider';
import { EntityMetadata } from '../types';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { PostgresDialect } from '../query/PostgresDialect';
import { QueryBuilder } from '../query/QueryBuilder';

// Lazy require to avoid hard dependency if not installed
let Pg: any;
try { Pg = require('pg'); } catch {}

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
export class PostgresProvider extends DatabaseProvider {
    private pool: any;
    private qb: QueryBuilder;

    constructor(connectionString: string, logger?: any) {
        super(connectionString, logger);
        this.qb = new QueryBuilder(new PostgresDialect());
    }

    /** Open a connection pool to PostgreSQL using the connection string. */
    public async connect(): Promise<void> {
        if (!Pg) throw new Error('pg module is not installed');
        const { Pool } = Pg;
        this.pool = new Pool({ connectionString: this.connectionString });
        this.isConnected = true;
    }

    /** Gracefully dispose of the connection pool. */
    public async disconnect(): Promise<void> {
        if (this.pool) await this.pool.end();
        this.isConnected = false;
    }

    /**
     * Create a table for the given entity metadata when it does not exist.
     * Also ensures declared indexes exist. For complex schemas prefer migrations.
     */
    public async createTable(entityMetadata: EntityMetadata): Promise<void> {
        // Simplified DDL: map to basic types; users should prefer migrations
        const cols = entityMetadata.columns.map(c => {
            const t = mapTypeToPg(c.type);
            const nn = c.nullable ? '' : ' NOT NULL';
            return `"${c.columnName}" ${t}${nn}`;
        });
        if (entityMetadata.primaryKeys.length > 0) {
            const pk = entityMetadata.primaryKeys.map(pk => `"${entityMetadata.columns.find(c => c.propertyName === pk)?.columnName || pk}"`).join(', ');
            cols.push(`PRIMARY KEY (${pk})`);
        }
        const sql = `CREATE TABLE IF NOT EXISTS "${entityMetadata.tableName}" (${cols.join(', ')})`;
        await this.executeNonQuery(sql);

        // Create indexes
        for (const index of entityMetadata.indexes) {
            const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
            const colsList = index.columns.map(c => `"${c}"`).join(', ');
            const idxSql = `CREATE ${uniqueKeyword}INDEX IF NOT EXISTS "${index.name}" ON "${entityMetadata.tableName}" (${colsList})`;
            await this.executeNonQuery(idxSql);
        }
    }

    /** Insert an entity row and return the populated entity (RETURNING *). */
    public async insert<T>(entity: T, entityClass: Function): Promise<T> {
        const meta = MetadataStorage.getEntity(entityClass);
        if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const cols = meta.columns.filter(c => !c.isGenerated);
        const names = cols.map(c => `"${c.columnName}"`);
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const values = cols.map(c => convertValueForPg((entity as any)[c.propertyName], c.type));
        const sql = `INSERT INTO "${meta.tableName}" (${names.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
        const rows = await this.executeQuery<any>(sql, values);
        Object.assign(entity as any, rows[0]);
        return entity;
    }

    /** Update a row by primary key; returns the same entity instance. */
    public async update<T>(entity: T, entityClass: Function): Promise<T> {
        const meta = MetadataStorage.getEntity(entityClass);
        if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const setCols = meta.columns.filter(c => !meta.primaryKeys.includes(c.propertyName) && !c.isGenerated);
        if (setCols.length === 0) return entity;
        const sets = setCols.map((c, i) => `"${c.columnName}" = $${i + 1}`);
        const setVals = setCols.map(c => convertValueForPg((entity as any)[c.propertyName], c.type));
        const where = meta.primaryKeys.map((pk, i) => `"${meta.columns.find(c => c.propertyName === pk)?.columnName || pk}" = $${setCols.length + i + 1}`);
        const whereVals = meta.primaryKeys.map(pk => (entity as any)[pk]);
        const sql = `UPDATE "${meta.tableName}" SET ${sets.join(', ')} WHERE ${where.join(' AND ')}`;
        await this.executeNonQuery(sql, [...setVals, ...whereVals]);
        return entity;
    }

    /** Delete a row by primary key. */
    public async delete<T>(entity: T, entityClass: Function): Promise<void> {
        const meta = MetadataStorage.getEntity(entityClass);
        if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const where = meta.primaryKeys.map((pk, i) => `"${meta.columns.find(c => c.propertyName === pk)?.columnName || pk}" = $${i + 1}`);
        const vals = meta.primaryKeys.map(pk => (entity as any)[pk]);
        const sql = `DELETE FROM "${meta.tableName}" WHERE ${where.join(' AND ')}`;
        await this.executeNonQuery(sql, vals);
    }

    /** Fetch a single row by its primary key value. */
    public async findById<T>(id: any, entityClass: new () => T): Promise<T | null> {
        const meta = MetadataStorage.getEntity(entityClass);
        if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const pk = meta.primaryKeys[0];
        const col = meta.columns.find(c => c.propertyName === pk)?.columnName || pk;
        const sql = `SELECT * FROM "${meta.tableName}" WHERE "${col}" = $1`;
        const rows = await this.executeQuery<any>(sql, [id]);
        const r = rows[0];
        return r ? mapRowToEntity(r, entityClass) : null;
    }

    /** Fetch all rows for the given entity type. */
    public async findAll<T>(entityClass: new () => T): Promise<T[]> {
        const meta = MetadataStorage.getEntity(entityClass);
        if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const sql = `SELECT * FROM "${meta.tableName}"`;
        const rows = await this.executeQuery<any>(sql);
        return rows.map(r => mapRowToEntity(r, entityClass));
    }

    /** Find rows by simple equality conditions { column: value }. */
    public async findWhere<T>(entityClass: new () => T, conditions: any): Promise<T[]> {
        const meta = MetadataStorage.getEntity(entityClass);
        if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const keys = Object.keys(conditions);
        const clauses = keys.map((k, i) => `"${meta.columns.find(c => c.propertyName === k || c.columnName === k)?.columnName || k}" = $${i + 1}`);
        const vals = keys.map(k => conditions[k]);
        const sql = `SELECT * FROM "${meta.tableName}" WHERE ${clauses.join(' AND ')}`;
        const rows = await this.executeQuery<any>(sql, vals);
        return rows.map(r => mapRowToEntity(r, entityClass));
    }

    /** Find rows where a column equals any of provided values using Postgres ANY($1). */
    public async findWhereIn<T>(entityClass: new () => T, column: string, values: any[]): Promise<T[]> {
        if (!values || values.length === 0) return [];
        const meta = MetadataStorage.getEntity(entityClass);
        if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const col = meta.columns.find(c => c.propertyName === column || c.columnName === column)?.columnName || column;
        const sql = `SELECT * FROM "${meta.tableName}" WHERE "${col}" = ANY($1)`;
        const rows = await this.executeQuery<any>(sql, [values]);
        return rows.map(r => mapRowToEntity(r, entityClass));
    }

    /** Low-level query execution returning rows. */
    protected async doExecuteQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
        const res = await this.pool.query(sql, params);
        return res.rows as T[];
    }

    /** Low-level non-query execution returning rowCount. */
    protected async doExecuteNonQuery(sql: string, params: any[] = []): Promise<number> {
        const res = await this.pool.query(sql, params);
        return res.rowCount;
    }

    /** Begin a transaction (sets a trace id for logging). */
    public async beginTransaction(): Promise<void> {
        if (this.inTransaction) throw new Error('Transaction already in progress');
        this.currentTraceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        await this.executeNonQuery('BEGIN');
        this.inTransaction = true;
    }
    /** Commit the current transaction. */
    public async commitTransaction(): Promise<void> {
        if (!this.inTransaction) throw new Error('No transaction in progress');
        await this.executeNonQuery('COMMIT');
        this.inTransaction = false;
        this.currentTraceId = undefined;
    }
    /** Roll back the current transaction. */
    public async rollbackTransaction(): Promise<void> {
        if (!this.inTransaction) throw new Error('No transaction in progress');
        await this.executeNonQuery('ROLLBACK');
        this.inTransaction = false;
        this.currentTraceId = undefined;
    }
}

/** Map logical column type to PostgreSQL type name. */
function mapTypeToPg(type: string): string {
    switch (type.toUpperCase()) {
        case 'TEXT': case 'STRING': return 'TEXT';
        case 'INTEGER': case 'NUMBER': return 'INTEGER';
        case 'REAL': case 'FLOAT': case 'DOUBLE': return 'DOUBLE PRECISION';
        case 'BOOLEAN': return 'BOOLEAN';
        case 'DATETIME': case 'DATE': return 'TIMESTAMPTZ';
        case 'BLOB': return 'BYTEA';
        case 'UUID': return 'UUID';
        case 'JSONB': return 'JSONB';
        case 'JSON': return 'JSON';
        default: return 'TEXT';
    }
}

/** Convert JS value to a PostgreSQL parameter according to column type. */
function convertValueForPg(value: any, type: string): any {
    if (value === null || value === undefined) return value;
    switch (type.toUpperCase()) {
        case 'JSON':
        case 'JSONB':
            return typeof value === 'string' ? value : JSON.stringify(value);
        default:
            return value;
    }
}

/** Convert PostgreSQL value to a JS runtime value according to mapped type. */
function convertValueFromPg(value: any, type: string): any {
    if (value === null || value === undefined) return value;
    switch (type.toUpperCase()) {
        case 'BOOLEAN': return Boolean(value);
        case 'INTEGER':
        case 'NUMBER': return typeof value === 'number' ? value : Number(value);
        case 'TIMESTAMPTZ':
        case 'DATETIME':
        case 'DATE': return value instanceof Date ? value : new Date(value);
        case 'JSONB':
        case 'JSON': return typeof value === 'string' ? JSON.parse(value) : value;
        default: return value;
    }
}

/** Map a row object to a new entity instance using entity metadata. */
function mapRowToEntity<T>(row: any, entityClass: new () => T): T {
    const entity = new entityClass();
    const meta = MetadataStorage.getEntity(entityClass);
    if (meta) {
        for (const col of meta.columns) {
            if (Object.prototype.hasOwnProperty.call(row, col.columnName)) {
                (entity as any)[col.propertyName] = convertValueFromPg(row[col.columnName], col.type);
            }
        }
    } else {
        Object.assign(entity as any, row);
    }
    return entity;
}


