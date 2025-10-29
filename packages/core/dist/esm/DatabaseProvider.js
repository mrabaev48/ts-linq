import { CircuitOpenError } from './types';
import { logInternalError } from './utils/InternalLogger';
/**
 * Abstract base class for database providers. Concrete providers must
 * implement all abstract methods to support connections, CRUD operations,
 * simple querying and transaction management.
 */
export class DatabaseProvider {
    /**
     * Create a provider with a given connection string.
     * @param connectionString Provider-specific connection string.
     */
    constructor(connectionString, logger, middlewares, softDelete, retryPolicy, poolOptions, healthCheck, circuitOptions) {
        this.isConnected = false;
        this.inTransaction = false;
        /** Logical provider name for logging/metrics (sqlite|postgresql|mysql|mssql|unknown). */
        this.providerName = 'unknown';
        /** Current health status and failure counter for backoff. */
        this.healthFailures = 0;
        this.healthStatus = 'healthy';
        /** Circuit breaker state. */
        this.circuitState = 'closed';
        this.circuitFailures = 0;
        this.halfOpenInFlight = 0;
        this.circuitOpenBackoffExp = 0;
        this.analysisEventsInWindow = 0;
        this.connectionString = connectionString;
        this.logger = logger;
        this.middlewares = middlewares;
        this.softDelete = softDelete;
        this.retryPolicy = retryPolicy;
        this.poolOptions = poolOptions;
        this.healthCheck = healthCheck;
        this.circuitOptions = circuitOptions;
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
        // Circuit breaker pre-check (short-circuit before any logging/instrumentation)
        this.preCheckCircuit();
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
        // Do not retry within an explicit transaction; also avoid retrying in half-open
        const allowRetry = !this.inTransaction && this.circuitState === 'closed';
        // Track half-open probe usage to enforce concurrency cap
        let decrementHalfOpenOnExit = false;
        if (this.circuitState === 'half-open') {
            decrementHalfOpenOnExit = true;
        }
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
                await this.maybeAnalyzeQuery({ sql, params, durationMs });
                await this.afterExecute(sql, params, result);
                // Success path: reset circuit if needed
                if (this.circuitState === 'half-open') {
                    this.transitionCircuit('closed', 'probe succeeded');
                }
                this.circuitFailures = 0;
                if (decrementHalfOpenOnExit) {
                    this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
                }
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
                await this.maybeAnalyzeQuery({ sql, params, durationMs, error: error });
                const isTransient = this.isTransientError(error);
                // Circuit breaker failure accounting
                const countOnlyTransient = this.circuitOptions?.countTransientOnly ?? true;
                const shouldCountFailure = !countOnlyTransient || isTransient;
                if (shouldCountFailure)
                    this.circuitFailures++;
                // If in half-open, immediate open on first failure
                if (this.circuitState === 'half-open') {
                    this.openCircuit('half-open probe failed');
                    if (decrementHalfOpenOnExit) {
                        this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
                    }
                    throw error;
                }
                // If in closed and threshold exceeded, open circuit
                const threshold = Math.max(1, this.circuitOptions?.failureThreshold ?? 5);
                if (this.circuitState === 'closed' && this.circuitFailures >= threshold) {
                    this.openCircuit('failure threshold reached');
                    if (decrementHalfOpenOnExit) {
                        this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
                    }
                    throw error;
                }
                const should = this.retryPolicy
                    ? this.retryPolicy.shouldRetry(error, attempt, this.inTransaction)
                    : isTransient;
                if (!allowRetry || !should || attempt >= maxAttempts) {
                    if (decrementHalfOpenOnExit) {
                        this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
                    }
                    throw error;
                }
                const jitter = Math.floor(Math.random() * 25);
                const defaultBackoff = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
                const backoff = this.retryPolicy?.getDelayMs?.(attempt) ?? defaultBackoff;
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
    /** Configure query performance analysis at runtime. */
    configureQueryAnalysis(options) {
        this.analysis = { ...this.analysis, ...options };
    }
    /** Provider hook: obtain an EXPLAIN plan for a given SQL if supported. */
    async getExplainPlan(_sql, _params) {
        // Default: not supported in base class
        return undefined;
    }
    /** Emit analysis event when thresholds are exceeded. */
    async maybeAnalyzeQuery(info) {
        const cfg = this.analysis;
        if (!cfg?.enabled)
            return;
        // only SELECT if configured
        const onlySelect = cfg.onlySelect ?? true;
        if (onlySelect && !/^\s*SELECT\b/i.test(info.sql))
            return;
        // sampling
        const rate = Math.max(0, Math.min(1, cfg.sampleRate ?? 1));
        if (rate < 1 && Math.random() > rate)
            return;
        // rate limiting per minute
        const now = Date.now();
        const windowStart = this.analysisEventsWindowStartMs ?? now;
        const perMinute = Math.max(1, cfg.rateLimitPerMinute ?? 120);
        if (now - windowStart >= 60000) {
            this.analysisEventsWindowStartMs = now;
            this.analysisEventsInWindow = 0;
        }
        if (this.analysisEventsInWindow >= perMinute)
            return;
        this.analysisEventsInWindow += 1;
        const explainT = cfg.explainThresholdMs ?? 500;
        const slowT = cfg.slowQueryThresholdMs ?? 1000;
        const needExplain = info.durationMs >= explainT && !info.error && !this.inTransaction;
        let plan;
        if (needExplain) {
            try {
                const timeoutMs = Math.max(1, cfg.explainTimeoutMs ?? 1000);
                const timed = Promise.race([
                    this.getExplainPlan(info.sql, info.params),
                    new Promise((resolve) => setTimeout(() => resolve(undefined), timeoutMs))
                ]);
                plan = await timed;
            }
            catch (e) {
                logInternalError('DatabaseProvider.maybeAnalyzeQuery.explain', e);
            }
        }
        // size limit on plan (stringifiable only)
        const maxChars = Math.max(1024, cfg.maxExplainChars ?? 65536);
        const safePlan = (() => {
            if (plan === undefined || plan === null)
                return plan;
            try {
                const s = typeof plan === 'string' ? plan : JSON.stringify(plan);
                if (s.length <= maxChars)
                    return plan;
                return s.slice(0, maxChars);
            }
            catch {
                return plan;
            }
        })();
        const payload = {
            sql: info.sql,
            params: info.params,
            durationMs: info.durationMs,
            provider: this.providerName,
            slow: info.durationMs >= slowT,
            explainPlan: safePlan,
            recommendations: cfg.recommendations ? this.deriveRecommendations(plan) : undefined
        };
        try {
            // Prefer dedicated hook if logger implements it; otherwise fallback to middleware afterExecute users
            this.logger?.analysis?.(payload);
            // Also notify middlewares if they expose analysis
            if (this.middlewares && this.middlewares.length > 0) {
                for (const mw of this.middlewares) {
                    try {
                        mw.analysis?.(payload);
                    }
                    catch (e) {
                        logInternalError('DatabaseProvider.maybeAnalyzeQuery.middleware', e);
                    }
                }
            }
        }
        catch (e) {
            logInternalError('DatabaseProvider.maybeAnalyzeQuery.logger', e);
        }
    }
    /** Heuristic recommendations from provider-agnostic plans. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    deriveRecommendations(_plan) {
        // Minimal placeholder: concrete providers can override getExplainPlan with richer structures
        return undefined;
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
    /** Circuit breaker: short-circuit if open or move to half-open if cooldown elapsed. */
    preCheckCircuit() {
        const enabled = this.circuitOptions?.enabled ?? true;
        if (!enabled)
            return;
        if (this.circuitState === 'open') {
            const now = Date.now();
            const openSince = this.circuitOpenedAt ?? now;
            const baseOpen = Math.max(1000, this.circuitOptions?.openDurationMs ?? 30000);
            const cap = Math.max(baseOpen, this.circuitOptions?.maxOpenDurationMs ?? 300000);
            const factor = Math.min(6, Math.max(0, this.circuitOpenBackoffExp));
            const openDuration = Math.min(baseOpen * Math.pow(2, factor), cap);
            if (now - openSince < openDuration) {
                throw new CircuitOpenError();
            }
            // Cooldown elapsed → move to half-open
            this.transitionCircuit('half-open', 'cooldown elapsed');
            this.halfOpenInFlight = 0;
        }
        if (this.circuitState === 'half-open') {
            const maxProbes = Math.max(1, this.circuitOptions?.halfOpenMaxCalls ?? 1);
            if (this.halfOpenInFlight >= maxProbes) {
                throw new CircuitOpenError('Half-open probes limit reached');
            }
            this.halfOpenInFlight += 1;
        }
    }
    openCircuit(reason) {
        this.circuitState = 'open';
        this.circuitOpenedAt = Date.now();
        this.circuitOpenBackoffExp = Math.min(6, this.circuitOpenBackoffExp + 1);
        this.logger?.circuit?.({
            state: 'open',
            provider: this.providerName,
            failures: this.circuitFailures,
            reason,
            halfOpenInFlight: this.halfOpenInFlight
        });
    }
    transitionCircuit(state, reason) {
        this.circuitState = state;
        if (state === 'closed') {
            this.circuitFailures = 0;
            this.circuitOpenedAt = undefined;
            this.halfOpenInFlight = 0;
            this.circuitOpenBackoffExp = 0;
        }
        if (state === 'open') {
            this.circuitOpenedAt = Date.now();
        }
        this.logger?.circuit?.({
            state,
            provider: this.providerName,
            failures: this.circuitFailures,
            reason,
            halfOpenInFlight: this.halfOpenInFlight
        });
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
            catch (e) {
                logInternalError('DatabaseProvider.beforeExecute.middleware', e);
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
            catch (e) {
                logInternalError('DatabaseProvider.afterExecute.middleware', e);
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
            catch (e) {
                logInternalError('DatabaseProvider.notifyEntityMaterialized.middleware', e);
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
    /** Current circuit breaker state (for diagnostics/tests). */
    get circuitStateLabel() {
        return this.circuitState;
    }
    /** Update circuit breaker options at runtime. */
    configureCircuit(options) {
        this.circuitOptions = { ...this.circuitOptions, ...options };
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
    /** Configure connection pool and health-check options at runtime. */
    configureConnection(options) {
        this.poolOptions = options.pool ?? this.poolOptions;
        this.healthCheck = options.health ?? this.healthCheck;
    }
    /**
     * Start periodic connection health checks if enabled.
     * Providers should call this after establishing a pool.
     */
    startHealthChecks(runPing) {
        if (!this.healthCheck?.enabled)
            return;
        const minI = this.healthCheck.minIntervalMs ?? this.healthCheck.intervalMs ?? 60000;
        const maxI = this.healthCheck.maxIntervalMs ?? Math.max(minI * 4, 60000);
        const degradeN = this.healthCheck.degradeAfterFailures ?? 3;
        const unhealthyN = this.healthCheck.unhealthyAfterFailures ?? 6;
        const scheduleNext = (delay) => {
            if (this.healthTimer)
                clearInterval(this.healthTimer);
            this.healthTimer = setInterval(() => {
                void runOnce();
            }, delay);
        };
        const runOnce = async () => {
            try {
                const timeoutMs = this.healthCheck?.timeoutMs;
                const started = Date.now();
                const pingPromise = runPing();
                const timed = typeof timeoutMs === 'number' && timeoutMs > 0
                    ? Promise.race([
                        pingPromise,
                        new Promise((_, rej) => setTimeout(() => rej(new Error('health-timeout')), timeoutMs))
                    ])
                    : pingPromise;
                const latency = await timed;
                const elapsed = latency ?? Date.now() - started;
                this.healthFailures = 0;
                this.healthStatus = 'healthy';
                this.logger?.connectionHealth?.({
                    healthy: true,
                    latencyMs: elapsed,
                    provider: this.providerName,
                    status: this.healthStatus
                });
                // If previously unhealthy opened circuit, close when back to healthy
                if (this.circuitState !== 'closed') {
                    this.transitionCircuit('closed', 'health restored');
                }
                scheduleNext(minI);
            }
            catch {
                this.healthFailures += 1;
                this.healthStatus =
                    this.healthFailures >= unhealthyN
                        ? 'unhealthy'
                        : this.healthFailures >= degradeN
                            ? 'degraded'
                            : 'healthy';
                this.logger?.connectionHealth?.({
                    healthy: false,
                    provider: this.providerName,
                    status: this.healthStatus
                });
                // Auto-open circuit when unhealthy
                if (this.healthStatus === 'unhealthy') {
                    this.openCircuit('health unhealthy');
                }
                // Exponential backoff within [minI, maxI]
                const attempt = Math.min(this.healthFailures, 10);
                const base = Math.min(minI * Math.pow(2, attempt - 1), maxI);
                const jitter = Math.floor(Math.random() * Math.floor(base * 0.1));
                const next = Math.min(base + jitter, maxI);
                scheduleNext(next);
            }
        };
        scheduleNext(minI);
        // Run first check immediately (non-blocking)
        void (async () => {
            await runOnce();
        })();
    }
    /** Stop health check scheduler when disconnecting. */
    stopHealthChecks() {
        if (this.healthTimer) {
            clearInterval(this.healthTimer);
            this.healthTimer = undefined;
        }
    }
    /** Force-open the circuit for a specified duration (ms). */
    forceOpen(reason, durationMs) {
        this.openCircuit(reason || 'manual open');
        if (typeof durationMs === 'number' && durationMs > 0) {
            this.circuitOpenedAt =
                Date.now() - (this.circuitOptions?.openDurationMs ?? 30000) + durationMs;
        }
    }
    /** Manually reset circuit to closed state. */
    manualReset(reason = 'manual reset') {
        this.transitionCircuit('closed', reason);
    }
}
//# sourceMappingURL=DatabaseProvider.js.map