"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseProvider = void 0;
/**
 * Abstract base class for database providers. Concrete providers must
 * implement all abstract methods to support connections, CRUD operations,
 * simple querying and transaction management.
 */
class DatabaseProvider {
    /**
     * Create a provider with a given connection string.
     * @param connectionString Provider-specific connection string.
     */
    constructor(connectionString, logger, middlewares, softDelete, retryPolicy) {
        this.isConnected = false;
        this.inTransaction = false;
        /** Logical provider name for logging/metrics (sqlite|postgresql|mysql|mssql|unknown). */
        this.providerName = 'unknown';
        this.connectionString = connectionString;
        this.logger = logger;
        this.middlewares = middlewares;
        this.softDelete = softDelete;
        this.retryPolicy = retryPolicy;
    }
    /** Insert many entities in a single transaction (default implementation). */
    async insertMany(entities, entityClass) {
        if (entities.length === 0)
            return entities;
        await this.beginTransaction();
        try {
            for (const entity of entities) {
                await this.insert(entity, entityClass);
            }
            await this.commitTransaction();
            return entities;
        }
        catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }
    /** Update many entities in a single transaction (default implementation). */
    async updateMany(entities, entityClass) {
        if (entities.length === 0)
            return entities;
        await this.beginTransaction();
        try {
            for (const entity of entities) {
                await this.update(entity, entityClass);
            }
            await this.commitTransaction();
            return entities;
        }
        catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }
    /** Upsert single entity: try update, fallback to insert when no rows updated. */
    async upsert(entity, entityClass) {
        try {
            return await this.update(entity, entityClass);
        }
        catch {
            return await this.insert(entity, entityClass);
        }
    }
    /** Upsert many entities within a transaction. */
    async upsertMany(entities, entityClass) {
        if (entities.length === 0)
            return entities;
        await this.beginTransaction();
        try {
            for (const entity of entities) {
                await this.upsert(entity, entityClass);
            }
            await this.commitTransaction();
            return entities;
        }
        catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }
    /** Execute a SQL query and return rows mapped as generic objects. */
    async executeQuery(sql, params = []) {
        return await this.executeWithRetry(() => this.doExecuteQuery(sql, params), sql, params);
    }
    /** Execute a non-query SQL statement and return affected row count. */
    async executeNonQuery(sql, params = []) {
        return await this.executeWithRetry(() => this.doExecuteNonQuery(sql, params), sql, params);
    }
    /**
     * Retry wrapper with basic exponential backoff + jitter for idempotent operations.
     * Retries only when not in a transaction and for errors deemed transient.
     */
    async executeWithRetry(fn, sql, params) {
        const maxAttempts = 3;
        const baseDelayMs = 50;
        const startedAt = Date.now();
        this.logger?.queryStart?.({
            sql,
            params,
            traceId: this.currentTraceId,
            provider: this.providerName
        });
        this.lastExecuteStartedAt = startedAt;
        await this.beforeExecute(sql, params);
        let attempt = 0;
        // Do not retry within an explicit transaction
        const allowRetry = !this.inTransaction;
        while (true) {
            try {
                const result = await fn();
                const durationMs = Date.now() - startedAt;
                this.logger?.queryEnd?.({
                    sql,
                    params,
                    durationMs,
                    traceId: this.currentTraceId,
                    rows: Array.isArray(result)
                        ? result.length
                        : typeof result === 'number'
                            ? result
                            : undefined,
                    provider: this.providerName
                });
                await this.afterExecute(sql, params, result);
                return result;
            }
            catch (error) {
                attempt++;
                const durationMs = Date.now() - startedAt;
                this.logger?.queryEnd?.({
                    sql,
                    params,
                    durationMs,
                    traceId: this.currentTraceId,
                    error: error,
                    provider: this.providerName
                });
                const isTransient = this.isTransientError(error);
                const should = this.retryPolicy
                    ? (this.retryPolicy.shouldRetryEx?.({
                        error,
                        attempt,
                        inTransaction: this.inTransaction,
                        sql,
                        params,
                        provider: this.providerName
                    }) ?? this.retryPolicy.shouldRetry(error, attempt, this.inTransaction))
                    : isTransient;
                if (!allowRetry || !should || attempt >= maxAttempts) {
                    throw error;
                }
                const jitter = Math.floor(Math.random() * 25);
                const defaultBackoff = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
                const backoff = this.retryPolicy ? this.retryPolicy.getDelayMs(attempt) : defaultBackoff;
                this.logger?.retry?.({
                    sql,
                    params,
                    attempt,
                    traceId: this.currentTraceId,
                    provider: this.providerName
                });
                await new Promise((res) => setTimeout(res, backoff));
                // next attempt
            }
        }
    }
    /** Basic transient error classifier. Providers may override for accuracy. */
    isTransientError(error) {
        const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
        return (message.includes('deadlock') ||
            message.includes('timeout') ||
            message.includes('connection') ||
            message.includes('too many connections') ||
            message.includes('econnreset'));
    }
    // Template Method hooks
    /** Called before each execute; override for logging/instrumentation. */
    /** Default no-op hook. Override in providers for logging/instrumentation. */
    async beforeExecute(sql, params) {
        if (!this.middlewares || this.middlewares.length === 0)
            return;
        const info = { sql, params, traceId: this.currentTraceId };
        for (const mw of this.middlewares) {
            try {
                await mw.beforeExecute?.(info);
            }
            catch {
                /* ignore middleware errors */
            }
        }
    }
    /** Called after each execute; override for logging/instrumentation. */
    /** Default no-op hook. Override in providers for logging/instrumentation. */
    async afterExecute(sql, params, result) {
        if (!this.middlewares || this.middlewares.length === 0)
            return;
        const rows = Array.isArray(result)
            ? result.length
            : typeof result === 'number'
                ? result
                : undefined;
        const durationMs = this.lastExecuteStartedAt ? Date.now() - this.lastExecuteStartedAt : 0;
        const info = { sql, params, durationMs, traceId: this.currentTraceId, rows };
        for (const mw of this.middlewares) {
            try {
                await mw.afterExecute?.(info);
            }
            catch {
                /* ignore middleware errors */
            }
        }
    }
    /** Notify middleware that an entity instance has been materialized. */
    async notifyEntityMaterialized(entity, metadata) {
        if (!this.middlewares || this.middlewares.length === 0)
            return;
        const info = { entity, metadata };
        for (const mw of this.middlewares) {
            try {
                await mw.entityMaterialized?.(info);
            }
            catch {
                /* ignore middleware errors */
            }
        }
    }
    /**
     * Whether the provider is currently connected.
     */
    get connected() {
        return this.isConnected;
    }
    /**
     * Whether a transaction is currently in progress.
     */
    get inTransactionState() {
        return this.inTransaction;
    }
    /** Soft delete configuration if enabled. */
    get softDeleteOptions() {
        return this.softDelete;
    }
    /** Expose provider label for metrics/loggers. */
    get providerLabel() {
        return this.providerName;
    }
    /** Expose logger instance for downstream components. */
    get loggerRef() {
        return this.logger;
    }
}
exports.DatabaseProvider = DatabaseProvider;
//# sourceMappingURL=DatabaseProvider.js.map