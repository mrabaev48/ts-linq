/**
 * Prometheus-backed SqlLogger. No hard dependency on prom-client; works as no-op when not present.
 */
/**
 * Prometheus-backed SqlLogger implementation.
 *
 * Usage:
 * ```ts
 * import { PrometheusSqlLogger } from 'ts-linq';
 * const logger = new PrometheusSqlLogger('orders-service', { prefix: 'tsl_' });
 * const ctx = new AppDbContext({ provider: 'sqlite', connectionString: ':memory:', logger });
 * ```
 *
 * Emitted metrics (label schema kept low-cardinality):
 * - db_query_total (Counter) — { provider, operation, entity, success }
 * - db_query_duration_ms (Histogram) — { provider, operation, entity, success }
 * - db_error_total (Counter) — { provider, operation, entity, error_type }
 *
 * Note: Provider and entity are parsed best-effort from SQL; provider label defaults to "unknown".
 * If 'prom-client' is not installed, the logger becomes a no-op.
 */
export class PrometheusSqlLogger {
    /**
     * Create a new PrometheusSqlLogger.
     * @param namespace Logical service name (reserved for future labels/exemplars).
     * @param options Optional configuration for metric prefix, buckets and DI client.
     */
    constructor(namespace, options) {
        this.enabled = false;
        this.prefix = options?.prefix ?? '';
        this.client = options?.client ?? this.safeRequirePromClient();
        if (!this.client)
            return;
        this.enabled = true;
        const buckets = options?.bucketsMs ?? [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
        const labelNames = ['provider', 'operation', 'entity', 'success'];
        this.queryTotal = new this.client.Counter({
            name: `${this.prefix}db_query_total`,
            help: 'Total DB queries',
            labelNames
        });
        this.queryDuration = new this.client.Histogram({
            name: `${this.prefix}db_query_duration_ms`,
            help: 'DB query duration (ms)',
            labelNames,
            buckets
        });
        this.errorTotal = new this.client.Counter({
            name: `${this.prefix}db_error_total`,
            help: 'Total DB errors',
            labelNames: ['provider', 'operation', 'entity', 'error_type']
        });
        this.retryTotal = new this.client.Counter({
            name: `${this.prefix}db_retry_total`,
            help: 'Total DB retry attempts',
            labelNames: ['provider', 'operation', 'entity']
        });
        if (this.client.Gauge) {
            const gauge = new this.client.Gauge({
                name: `${this.prefix}db_active_transactions`,
                help: 'Active DB transactions',
                labelNames: ['provider']
            });
            this.activeTransactions = {
                inc: (labels, v) => {
                    try {
                        gauge.inc(labels, v);
                    }
                    catch {
                        /* ignore */
                    }
                },
                dec: (labels, v) => {
                    try {
                        gauge.dec(labels, v);
                    }
                    catch {
                        /* ignore */
                    }
                }
            };
        }
        // optional cache metrics (off by default unless used)
        this.cacheHits = new this.client.Counter({
            name: `${this.prefix}db_cache_hits_total`,
            help: 'DB cache hits',
            labelNames: ['cache', 'provider']
        });
        this.cacheMisses = new this.client.Counter({
            name: `${this.prefix}db_cache_misses_total`,
            help: 'DB cache misses',
            labelNames: ['cache', 'provider']
        });
        // optional detailed counters for count cache
        this.countCacheTtlHits = new this.client.Counter({
            name: `${this.prefix}db_count_cache_ttl_hits_total`,
            help: 'Count cache TTL hits',
            labelNames: ['provider']
        });
        this.countCacheHardHits = new this.client.Counter({
            name: `${this.prefix}db_count_cache_hard_hits_total`,
            help: 'Count cache hard hits (external or no TTL)',
            labelNames: ['provider']
        });
        if (this.client.Gauge) {
            this.cacheSizeGauge = new this.client.Gauge({
                name: `${this.prefix}db_cache_size`,
                help: 'DB cache size (items)',
                labelNames: ['cache', 'provider']
            });
        }
        this.cacheEvictions = new this.client.Counter({
            name: `${this.prefix}db_cache_evictions_total`,
            help: 'DB cache evictions due to capacity limits',
            labelNames: ['cache', 'provider']
        });
    }
    /** No-op (metrics are recorded on queryEnd). */
    queryStart(_info) {
        // Intentionally empty: we record on queryEnd with duration.
    }
    /** Record query counters and durations, and errors if present. */
    queryEnd(info) {
        if (!this.enabled || !this.client || !this.queryTotal || !this.queryDuration)
            return;
        const op = this.parseOperation(info.sql);
        const entity = this.parseEntity(info.sql) || 'unknown';
        const provider = info.provider || 'unknown';
        const success = info.error ? 'false' : 'true';
        const labels = { provider, operation: op, entity, success };
        try {
            this.queryTotal.labels(labels).inc(1);
            // Attach exemplar when traceId is present and prom-client supports it
            const duration = Math.max(0, info.durationMs);
            try {
                this.queryDuration
                    .labels(labels)
                    .observe(duration, info.traceId
                    ? { traceId: info.traceId }
                    : undefined);
            }
            catch {
                this.queryDuration.labels(labels).observe(duration);
            }
            if (info.error && this.errorTotal) {
                const errLabels = {
                    provider,
                    operation: op,
                    entity,
                    error_type: info.error.name || 'Error'
                };
                this.errorTotal.labels(errLabels).inc(1);
            }
        }
        catch {
            /* swallow metric errors */
        }
    }
    /** Record a retry attempt. */
    retry(info) {
        if (!this.enabled || !this.client || !this.retryTotal)
            return;
        const op = this.parseOperation(info.sql);
        const entity = this.parseEntity(info.sql) || 'unknown';
        const provider = info.provider || 'unknown';
        try {
            this.retryTotal.labels({ provider, operation: op, entity }).inc(1);
        }
        catch {
            /* ignore */
        }
    }
    /** Track active transactions gauge. */
    transactionStart(info) {
        if (!this.enabled || !this.activeTransactions)
            return;
        const provider = info.provider || 'unknown';
        try {
            this.activeTransactions.inc({ provider }, 1);
        }
        catch {
            /* ignore */
        }
    }
    transactionEnd(info) {
        if (!this.enabled || !this.activeTransactions)
            return;
        const provider = info.provider || 'unknown';
        try {
            this.activeTransactions.dec({ provider }, 1);
        }
        catch {
            /* ignore */
        }
    }
    /** Cache hit/miss hook. */
    cache(info) {
        if (!this.enabled || !this.client)
            return;
        const provider = info.provider || 'unknown';
        try {
            if (info.hit)
                this.cacheHits?.labels({ cache: info.cache, provider }).inc(1);
            else
                this.cacheMisses?.labels({ cache: info.cache, provider }).inc(1);
            if (info.cache === 'count' && info.hit) {
                const ttl = info.ttl;
                if (ttl === true)
                    this.countCacheTtlHits?.labels({ provider }).inc(1);
                else if (ttl === false)
                    this.countCacheHardHits?.labels({ provider }).inc(1);
            }
        }
        catch {
            /* ignore */
        }
    }
    /** Cache size setter (optional API, used via duck typing). */
    cacheSize(info) {
        if (!this.enabled || !this.cacheSizeGauge)
            return;
        const provider = info.provider || 'unknown';
        try {
            this.cacheSizeGauge?.set?.({ cache: info.cache, provider }, info.size);
        }
        catch {
            /* ignore */
        }
    }
    /** Eviction counter (optional API, used via duck typing). */
    cacheEvicted(info) {
        if (!this.enabled || !this.cacheEvictions)
            return;
        const provider = info.provider || 'unknown';
        try {
            this.cacheEvictions.labels({ cache: info.cache, provider }).inc(1);
        }
        catch (e) {
            try {
                const { warnIfLoggerDebug } = require('./MetricsSafe');
                warnIfLoggerDebug('cacheEvicted', e);
            }
            catch {
                /* ignore */
            }
        }
    }
    safeRequirePromClient() {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const pc = require('prom-client');
            if (pc && pc.Counter && pc.Histogram) {
                return pc;
            }
        }
        catch {
            /* not installed */
        }
        return undefined;
    }
    parseOperation(sql) {
        const match = sql.trim().match(/^(SELECT|INSERT|UPDATE|DELETE)\b/i);
        return match ? match[1].toUpperCase() : 'OTHER';
    }
    parseEntity(sql) {
        const up = sql.toUpperCase();
        // FROM table or INTO table
        let match = up.match(/\bFROM\s+([A-Z0-9_"`\[\]]+)/);
        if (match && match[1])
            return this.cleanIdentifier(match[1]);
        match = up.match(/\bINTO\s+([A-Z0-9_"`\[\]]+)/);
        if (match && match[1])
            return this.cleanIdentifier(match[1]);
        // UPDATE table SET
        match = up.match(/^UPDATE\s+([A-Z0-9_"`\[\]]+)/);
        if (match && match[1])
            return this.cleanIdentifier(match[1]);
        return undefined;
    }
    cleanIdentifier(id) {
        return id.replace(/^["`\[]|["`\]]$/g, '');
    }
}
//# sourceMappingURL=PrometheusSqlLogger.js.map