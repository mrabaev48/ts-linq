import type { EntityMetadata, OrmMiddleware, RetryPolicy, SqlLogger, SoftDeleteOptions, SqlParameter } from './types';
import type { SqlDialect } from './query/SqlDialect';
/**
 * Abstract base class for database providers. Concrete providers must
 * implement all abstract methods to support connections, CRUD operations,
 * simple querying and transaction management.
 */
export declare abstract class DatabaseProvider {
    protected connectionString: string;
    protected isConnected: boolean;
    protected inTransaction: boolean;
    protected logger?: SqlLogger;
    protected currentTraceId?: string;
    protected middlewares?: OrmMiddleware[];
    private lastExecuteStartedAt?;
    protected softDelete?: SoftDeleteOptions;
    protected retryPolicy?: RetryPolicy;
    /** Logical provider name for logging/metrics (sqlite|postgresql|mysql|mssql|unknown). */
    protected providerName: string;
    /**
     * Create a provider with a given connection string.
     * @param connectionString Provider-specific connection string.
     */
    constructor(connectionString: string, logger?: SqlLogger, middlewares?: OrmMiddleware[], softDelete?: SoftDeleteOptions, retryPolicy?: RetryPolicy);
    /** Connect to the database. */
    abstract connect(): Promise<void>;
    /** Disconnect from the database and release resources. */
    abstract disconnect(): Promise<void>;
    /** Create a table for the provided entity metadata if it does not exist. */
    abstract createTable(entityMetadata: EntityMetadata): Promise<void>;
    /** Return SQL dialect used by this provider (Strategy per provider). */
    abstract getDialect(): SqlDialect;
    /** Insert an entity instance into its table and return the inserted entity. */
    abstract insert<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Update an existing entity row and return the updated entity. */
    abstract update<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Delete an entity row. */
    abstract delete<T extends object>(entity: T, entityClass: Function): Promise<void>;
    /** Find an entity by primary key value. */
    abstract findById<T extends object>(id: unknown, entityClass: new () => T): Promise<T | null>;
    /** Get all entities of a given type. */
    abstract findAll<T extends object>(entityClass: new () => T): Promise<T[]>;
    /** Find entities by a simple conditions object (key/value pairs). */
    abstract findWhere<T extends object>(entityClass: new () => T, conditions: Record<string, unknown>): Promise<T[]>;
    /** Find entities where a column value is in a list. */
    abstract findWhereIn<T extends object>(entityClass: new () => T, column: string, values: unknown[]): Promise<T[]>;
    /** Insert many entities in a single transaction (default implementation). */
    insertMany<T extends object>(entities: T[], entityClass: Function): Promise<T[]>;
    /** Update many entities in a single transaction (default implementation). */
    updateMany<T extends object>(entities: T[], entityClass: Function): Promise<T[]>;
    /** Upsert single entity: try update, fallback to insert when no rows updated. */
    upsert<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Upsert many entities within a transaction. */
    upsertMany<T extends object>(entities: T[], entityClass: Function): Promise<T[]>;
    /** Execute a SQL query and return rows mapped as generic objects. */
    executeQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]>;
    /** Provider-specific implementation of query execution. */
    protected abstract doExecuteQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]>;
    /** Execute a non-query SQL statement and return affected row count. */
    executeNonQuery(sql: string, params?: readonly SqlParameter[]): Promise<number>;
    /**
     * Retry wrapper with basic exponential backoff + jitter for idempotent operations.
     * Retries only when not in a transaction and for errors deemed transient.
     */
    private executeWithRetry;
    /** Basic transient error classifier. Providers may override for accuracy. */
    protected isTransientError(error: unknown): boolean;
    /** Provider-specific implementation of non-query execution. */
    protected abstract doExecuteNonQuery(sql: string, params?: readonly SqlParameter[]): Promise<number>;
    /** Called before each execute; override for logging/instrumentation. */
    /** Default no-op hook. Override in providers for logging/instrumentation. */
    protected beforeExecute(sql: string, params: readonly SqlParameter[]): Promise<void>;
    /** Called after each execute; override for logging/instrumentation. */
    /** Default no-op hook. Override in providers for logging/instrumentation. */
    protected afterExecute(sql: string, params: readonly SqlParameter[], result: unknown): Promise<void>;
    /** Notify middleware that an entity instance has been materialized. */
    protected notifyEntityMaterialized<T extends object>(entity: T, metadata?: EntityMetadata): Promise<void>;
    /** Begin a transaction. */
    abstract beginTransaction(): Promise<void>;
    /** Commit the current transaction. */
    abstract commitTransaction(): Promise<void>;
    /** Roll back the current transaction. */
    abstract rollbackTransaction(): Promise<void>;
    /**
     * Whether the provider is currently connected.
     */
    get connected(): boolean;
    /**
     * Whether a transaction is currently in progress.
     */
    get inTransactionState(): boolean;
    /** Soft delete configuration if enabled. */
    get softDeleteOptions(): SoftDeleteOptions | undefined;
    /** Expose provider label for metrics/loggers. */
    get providerLabel(): string;
    /** Expose logger instance for downstream components. */
    get loggerRef(): SqlLogger | undefined;
}
//# sourceMappingURL=DatabaseProvider.d.ts.map