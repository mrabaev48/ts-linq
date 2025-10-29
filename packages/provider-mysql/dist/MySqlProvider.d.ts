import type { EntityMetadata, SqlLogger, RetryPolicy, OrmMiddleware, SoftDeleteOptions, SqlParameter, SqlDialect, ConnectionPoolOptions, ConnectionHealthCheckOptions } from '@ts-linq/types';
import { DatabaseProvider } from '@ts-linq/core';
export declare class MySqlProvider extends DatabaseProvider {
    private pool;
    private ddl;
    constructor(connectionString: string, logger?: SqlLogger, middlewares?: OrmMiddleware[], softDelete?: SoftDeleteOptions, retryPolicy?: RetryPolicy, poolOptions?: ConnectionPoolOptions, healthCheck?: ConnectionHealthCheckOptions);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    createTable(entity: EntityMetadata): Promise<void>;
    insert<T extends object>(entity: T, entityClass: Function): Promise<T>;
    update<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Upsert using INSERT ... ON DUPLICATE KEY UPDATE ... */
    upsert<T extends object>(entity: T, entityClass: Function): Promise<T>;
    delete<T extends object>(entity: T, entityClass: Function): Promise<void>;
    findById<T extends object>(id: unknown, entityClass: new () => T): Promise<T | null>;
    findAll<T extends object>(entityClass: new () => T): Promise<T[]>;
    findWhere<T extends object>(entityClass: new () => T, conditions: Record<string, unknown>): Promise<T[]>;
    findWhereIn<T extends object>(entityClass: new () => T, column: string, values: unknown[]): Promise<T[]>;
    protected doExecuteQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]>;
    protected doExecuteNonQuery(sql: string, params?: readonly SqlParameter[]): Promise<number>;
    /** Obtain MySQL EXPLAIN plan (JSON where supported) */
    protected getExplainPlan(sql: string, params: readonly SqlParameter[]): Promise<unknown | undefined>;
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
    /** Provide SQL dialect for this provider. */
    getDialect(): SqlDialect;
    /** Coerce arbitrary JS value into a valid SqlParameter for MySQL. */
    private coerceToSqlParameter;
    private generateInsertSql;
    private generateUpdateSql;
    private generateDeleteSql;
    private mapRowToEntity;
}
//# sourceMappingURL=MySqlProvider.d.ts.map