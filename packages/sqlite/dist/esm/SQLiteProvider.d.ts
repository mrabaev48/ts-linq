import { DatabaseProvider, EntityMetadata, RetryPolicy, SqlParameter, OrmMiddleware, SoftDeleteOptions, SqlLogger, SqlDialect } from '@ts-linq/core';
/**
 * SQLite implementation of `DatabaseProvider` using the `sqlite3` package.
 * Handles connection lifecycle, DDL/DML generation and execution, and
 * simple value conversions between JS and SQLite.
 *
 * Note: sqlite3 driver is callback-based; provider wraps calls into Promises.
 */
export declare class SQLiteProvider extends DatabaseProvider {
    private db;
    private ddl;
    constructor(connectionString: string, logger?: SqlLogger, middlewares?: OrmMiddleware[], softDelete?: SoftDeleteOptions, retryPolicy?: RetryPolicy);
    /** Open a connection to the SQLite database and enable foreign keys. */
    connect(): Promise<void>;
    /** Close the SQLite database connection if open. */
    disconnect(): Promise<void>;
    /** Create a table from entity metadata and ensure indexes exist. */
    createTable(entityMetadata: EntityMetadata): Promise<void>;
    /** Insert the entity and set generated primary key when applicable. */
    insert<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Update the entity row by primary key; supports optimistic concurrency via version column; throws if nothing affected. */
    update<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Delete the entity row by primary key; throws if nothing affected. */
    delete<T extends object>(entity: T, entityClass: Function): Promise<void>;
    /** Fetch a single entity by primary key value. */
    findById<T extends object>(id: unknown, entityClass: new () => T): Promise<T | null>;
    /** Fetch all rows for the given entity type. */
    findAll<T extends object>(entityClass: new () => T): Promise<T[]>;
    /** Fetch rows that match a simple conditions object. */
    findWhere<T extends object>(entityClass: new () => T, conditions: Record<string, unknown>): Promise<T[]>;
    /** Fetch rows where a single column value is within a list (IN clause). */
    findWhereIn<T extends object>(entityClass: new () => T, column: string, values: unknown[]): Promise<T[]>;
    /** Execute a query and return raw rows. */
    protected doExecuteQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]>;
    /** Execute a non-query statement and return affected rows count. */
    protected doExecuteNonQuery(sql: string, params?: readonly SqlParameter[]): Promise<number>;
    /** Begin a SQLite transaction. */
    beginTransaction(): Promise<void>;
    /** Commit the current SQLite transaction. */
    commitTransaction(): Promise<void>;
    /** Roll back the current SQLite transaction. */
    rollbackTransaction(): Promise<void>;
    /** Provide SQL dialect for this provider. */
    getDialect(): SqlDialect;
    /** Generate INSERT SQL and parameter list for the given entity. */
    private generateInsertSql;
    /** Generate UPDATE SQL and params based on non-PK columns and PK WHERE clause. */
    private generateUpdateSql;
    /** Generate DELETE SQL and params using primary key values. */
    private generateDeleteSql;
    /** Map a generic type string to an SQLite column type. */
    private mapTypeToSQLite;
    /** Map a database row object to a new entity instance using metadata. */
    private mapRowToEntity;
    /** Coerce arbitrary value into SQL parameter type accepted by SQLite. */
    private coerceToSqlParameter;
    /** Convert a JS value to a DB-storable value according to type. */
    private convertValueForDatabase;
    /** Convert a DB value to a JS runtime value according to type. */
    private convertValueFromDatabase;
}
//# sourceMappingURL=SQLiteProvider.d.ts.map