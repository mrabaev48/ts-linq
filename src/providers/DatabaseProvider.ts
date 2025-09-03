import { EntityMetadata, OrmMiddleware, SqlLogger, SoftDeleteOptions } from '../types';

/**
 * Abstract base class for database providers. Concrete providers must
 * implement all abstract methods to support connections, CRUD operations,
 * simple querying and transaction management.
 */
export abstract class DatabaseProvider {
    protected connectionString: string;
    protected isConnected: boolean = false;
    protected inTransaction: boolean = false;
    protected logger?: SqlLogger;
    protected currentTraceId?: string;
    protected middlewares?: OrmMiddleware[];
    private lastExecuteStartedAt?: number;
    protected softDelete?: SoftDeleteOptions;
    /** Logical provider name for logging/metrics (sqlite|postgresql|mysql|mssql|unknown). */
    protected providerName: string = 'unknown';

    /**
     * Create a provider with a given connection string.
     * @param connectionString Provider-specific connection string.
     */
    constructor(connectionString: string, logger?: SqlLogger, middlewares?: OrmMiddleware[], softDelete?: SoftDeleteOptions) {
        this.connectionString = connectionString;
        this.logger = logger;
        this.middlewares = middlewares;
        this.softDelete = softDelete;
    }

    /** Connect to the database. */
    public abstract connect(): Promise<void>;
    /** Disconnect from the database and release resources. */
    public abstract disconnect(): Promise<void>;
    /** Create a table for the provided entity metadata if it does not exist. */
    public abstract createTable(entityMetadata: EntityMetadata): Promise<void>;
    /** Insert an entity instance into its table and return the inserted entity. */
    public abstract insert<T>(entity: T, entityClass: Function): Promise<T>;
    /** Update an existing entity row and return the updated entity. */
    public abstract update<T>(entity: T, entityClass: Function): Promise<T>;
    /** Delete an entity row. */
    public abstract delete<T>(entity: T, entityClass: Function): Promise<void>;
    /** Find an entity by primary key value. */
    public abstract findById<T>(id: any, entityClass: new () => T): Promise<T | null>;
    /** Get all entities of a given type. */
    public abstract findAll<T>(entityClass: new () => T): Promise<T[]>;
    /** Find entities by a simple conditions object (key/value pairs). */
    public abstract findWhere<T>(entityClass: new () => T, conditions: any): Promise<T[]>;
    /** Find entities where a column value is in a list. */
    public abstract findWhereIn<T>(entityClass: new () => T, column: string, values: any[]): Promise<T[]>;

    /** Insert many entities in a single transaction (default implementation). */
    public async insertMany<T>(entities: T[], entityClass: Function): Promise<T[]> {
        if (entities.length === 0) return entities;
        await this.beginTransaction();
        try {
            for (const e of entities) {
                await this.insert(e, entityClass);
            }
            await this.commitTransaction();
            return entities;
        } catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }

    /** Update many entities in a single transaction (default implementation). */
    public async updateMany<T>(entities: T[], entityClass: Function): Promise<T[]> {
        if (entities.length === 0) return entities;
        await this.beginTransaction();
        try {
            for (const e of entities) {
                await this.update(e, entityClass);
            }
            await this.commitTransaction();
            return entities;
        } catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }

    /** Upsert single entity: try update, fallback to insert when no rows updated. */
    public async upsert<T>(entity: T, entityClass: Function): Promise<T> {
        try {
            return await this.update(entity, entityClass);
        } catch {
            return await this.insert(entity, entityClass);
        }
    }

    /** Upsert many entities within a transaction. */
    public async upsertMany<T>(entities: T[], entityClass: Function): Promise<T[]> {
        if (entities.length === 0) return entities;
        await this.beginTransaction();
        try {
            for (const e of entities) {
                await this.upsert(e, entityClass);
            }
            await this.commitTransaction();
            return entities;
        } catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }
    /** Execute a SQL query and return rows mapped as generic objects. */
    public async executeQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
        return await this.executeWithRetry<T[]>(() => this.doExecuteQuery<T>(sql, params), sql, params);
    }
    /** Provider-specific implementation of query execution. */
    protected abstract doExecuteQuery<T>(sql: string, params?: any[]): Promise<T[]>;

    /** Execute a non-query SQL statement and return affected row count. */
    public async executeNonQuery(sql: string, params: any[] = []): Promise<number> {
        return await this.executeWithRetry<number>(() => this.doExecuteNonQuery(sql, params), sql, params);
    }

    /**
     * Retry wrapper with basic exponential backoff + jitter for idempotent operations.
     * Retries only when not in a transaction and for errors deemed transient.
     */
    private async executeWithRetry<T>(fn: () => Promise<T>, sql: string, params: any[]): Promise<T> {
        const maxAttempts = 3;
        const baseDelayMs = 50;
        const startedAt = Date.now();
        this.logger?.queryStart?.({ sql, params, traceId: this.currentTraceId, provider: this.providerName });
        this.lastExecuteStartedAt = startedAt;
        await this.beforeExecute(sql, params);
        let attempt = 0;
        // Do not retry within an explicit transaction
        const allowRetry = !this.inTransaction;
        while (true) {
            try {
                const result = await fn();
                const durationMs = Date.now() - startedAt;
                this.logger?.queryEnd?.({ sql, params, durationMs, traceId: this.currentTraceId, rows: Array.isArray(result) ? (result as any[]).length : (typeof result === 'number' ? result : undefined), provider: this.providerName });
                await this.afterExecute(sql, params, result);
                return result;
            } catch (error: any) {
                attempt++;
                const durationMs = Date.now() - startedAt;
                this.logger?.queryEnd?.({ sql, params, durationMs, traceId: this.currentTraceId, error, provider: this.providerName });
                const isTransient = this.isTransientError(error);
                if (!allowRetry || !isTransient || attempt >= maxAttempts) {
                    throw error;
                }
                const jitter = Math.floor(Math.random() * 25);
                const backoff = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
                this.logger?.retry?.({ sql, params, attempt, traceId: this.currentTraceId, provider: this.providerName });
                await new Promise(res => setTimeout(res, backoff));
                // next attempt
            }
        }
    }

    /** Basic transient error classifier. Providers may override for accuracy. */
    protected isTransientError(error: any): boolean {
        const message = (error?.message || '').toLowerCase();
        return (
            message.includes('deadlock') ||
            message.includes('timeout') ||
            message.includes('connection') ||
            message.includes('too many connections') ||
            message.includes('econnreset')
        );
    }
    /** Provider-specific implementation of non-query execution. */
    protected abstract doExecuteNonQuery(sql: string, params?: any[]): Promise<number>;

    // Template Method hooks
    /** Called before each execute; override for logging/instrumentation. */
    /** Default no-op hook. Override in providers for logging/instrumentation. */
    protected async beforeExecute(sql: string, params: any[]): Promise<void> {
        if (!this.middlewares || this.middlewares.length === 0) return;
        const info = { sql, params, traceId: this.currentTraceId };
        for (const mw of this.middlewares) {
            try { await mw.beforeExecute?.(info); } catch { /* ignore middleware errors */ }
        }
    }
    /** Called after each execute; override for logging/instrumentation. */
    /** Default no-op hook. Override in providers for logging/instrumentation. */
    protected async afterExecute(sql: string, params: any[], result: any): Promise<void> {
        if (!this.middlewares || this.middlewares.length === 0) return;
        const rows = Array.isArray(result) ? (result as any[]).length : (typeof result === 'number' ? result : undefined);
        const durationMs = this.lastExecuteStartedAt ? (Date.now() - this.lastExecuteStartedAt) : 0;
        const info = { sql, params, durationMs, traceId: this.currentTraceId, rows } as any;
        for (const mw of this.middlewares) {
            try { await mw.afterExecute?.(info); } catch { /* ignore middleware errors */ }
        }
    }

    /** Notify middleware that an entity instance has been materialized. */
    protected async notifyEntityMaterialized(entity: any, metadata?: EntityMetadata): Promise<void> {
        if (!this.middlewares || this.middlewares.length === 0) return;
        const info = { entity, metadata };
        for (const mw of this.middlewares) {
            try { await mw.entityMaterialized?.(info); } catch { /* ignore middleware errors */ }
        }
    }

    /** Begin a transaction. */
    public abstract beginTransaction(): Promise<void>;
    /** Commit the current transaction. */
    public abstract commitTransaction(): Promise<void>;
    /** Roll back the current transaction. */
    public abstract rollbackTransaction(): Promise<void>;

    /**
     * Whether the provider is currently connected.
     */
    public get connected(): boolean {
        return this.isConnected;
    }

    /**
     * Whether a transaction is currently in progress.
     */
    public get inTransactionState(): boolean {
        return this.inTransaction;
    }

    /** Soft delete configuration if enabled. */
    public get softDeleteOptions(): SoftDeleteOptions | undefined {
        return this.softDelete;
    }
}
