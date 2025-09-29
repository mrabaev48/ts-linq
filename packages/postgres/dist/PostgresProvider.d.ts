import type { EntityMetadata, RetryPolicy, SqlParameter, OrmMiddleware, SoftDeleteOptions, SqlLogger, SqlDialect } from '@ts-linq/core';
import { DatabaseProvider } from '@ts-linq/core';
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
export declare class PostgresProvider extends DatabaseProvider {
    private pool;
    private qb;
    private ddl;
    /** Map a row object to a new entity instance using entity metadata and notify middleware. */
    private mapRowToEntity;
    constructor(connectionString: string, logger?: SqlLogger, middlewares?: OrmMiddleware[], softDelete?: SoftDeleteOptions, retryPolicy?: RetryPolicy);
    private coerceToSqlParameter;
    /** Open a connection pool to PostgreSQL using the connection string. */
    connect(): Promise<void>;
    /** Gracefully dispose of the connection pool. */
    disconnect(): Promise<void>;
    /**
     * Create a table for the given entity metadata when it does not exist.
     * Also ensures declared indexes exist. For complex schemas prefer migrations.
     */
    createTable(entityMetadata: EntityMetadata): Promise<void>;
    /** Insert an entity row and return the populated entity (RETURNING *). */
    insert<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Update a row by primary key; supports optimistic concurrency via version column. */
    update<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Upsert using INSERT ... ON CONFLICT (pk...) DO UPDATE SET ... RETURNING *. */
    upsert<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Delete a row by primary key. */
    delete<T extends object>(entity: T, entityClass: Function): Promise<void>;
    /** Provide SQL dialect for this provider. */
    getDialect(): SqlDialect;
    /** Fetch a single row by its primary key value. */
    findById<T extends object>(id: unknown, entityClass: new () => T): Promise<T | null>;
    /** Fetch all rows for the given entity type. */
    findAll<T extends object>(entityClass: new () => T): Promise<T[]>;
    /** Find rows by simple equality conditions { column: value }. */
    findWhere<T extends object>(entityClass: new () => T, conditions: Record<string, unknown>): Promise<T[]>;
    /** Find rows where a column equals any of provided values using Postgres ANY($1). */
    findWhereIn<T extends object>(entityClass: new () => T, column: string, values: unknown[]): Promise<T[]>;
    /** Low-level query execution returning rows. */
    protected doExecuteQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]>;
    /** Low-level non-query execution returning rowCount. */
    protected doExecuteNonQuery(sql: string, params?: readonly SqlParameter[]): Promise<number>;
    /** Begin a transaction (sets a trace id for logging). */
    beginTransaction(): Promise<void>;
    /** Commit the current transaction. */
    commitTransaction(): Promise<void>;
    /** Roll back the current transaction. */
    rollbackTransaction(): Promise<void>;
}
//# sourceMappingURL=PostgresProvider.d.ts.map