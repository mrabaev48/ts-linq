export class PrometheusSqlLogger {
    constructor(namespace, options) {
        this.enabled = false;
        this.lastConnectionStatus = new Map();
        this.maskSql = false;
        this.maskPatterns = [];
        this.prefix = options?.prefix ?? '';
        this.client = options?.client ?? this.safeRequirePromClient();
        this.maskSql = !!options?.maskSql;
        this.maskPatterns = options?.maskPatterns ?? [];
        if (!this.client)
            return;
        this.enabled = true;
        const buckets = options?.bucketsMs ?? [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
        this.initQueryMetrics(buckets);
        this.initCacheMetrics();
        this.initHealthMetrics(buckets);
        this.initCircuitMetrics();
        this.initFallbackMetrics();
    }
    initQueryMetrics(buckets) {
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
                    catch { }
                },
                dec: (labels, v) => {
                    try {
                        gauge.dec(labels, v);
                    }
                    catch { }
                }
            };
        }
    }
    initCacheMetrics() {
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
    initHealthMetrics(buckets) {
        if (this.client.Gauge) {
            this.connectionHealthGauge = new this.client.Gauge({
                name: `${this.prefix}db_connection_health`,
                help: 'DB connection health status (1 healthy, 0 unhealthy)',
                labelNames: ['provider', 'status']
            });
            this.connectionDegradedGauge = new this.client.Gauge({
                name: `${this.prefix}db_connection_degraded`,
                help: 'DB connection degraded status (1 degraded, 0 otherwise)',
                labelNames: ['provider']
            });
        }
        this.connectionLatency = new this.client.Histogram({
            name: `${this.prefix}db_connection_latency_ms`,
            help: 'DB health-check ping latency (ms)',
            labelNames: ['provider', 'status'],
            buckets
        });
        this.connectionStatusTransitions = new this.client.Counter({
            name: `${this.prefix}db_connection_status_transitions_total`,
            help: 'DB connection health status transitions',
            labelNames: ['provider', 'from', 'to']
        });
    }
    initCircuitMetrics() {
        this.circuitTransitions = new this.client.Counter({
            name: `${this.prefix}db_circuit_transitions_total`,
            help: 'DB circuit breaker state transitions',
            labelNames: ['provider', 'from', 'to']
        });
        this.circuitOpenTotal = new this.client.Counter({
            name: `${this.prefix}db_circuit_open_total`,
            help: 'DB circuit opened events',
            labelNames: ['provider', 'reason']
        });
        if (this.client.Gauge) {
            this.circuitStateGauge = new this.client.Gauge({
                name: `${this.prefix}db_circuit_state`,
                help: 'DB circuit state (0 closed, 0.5 half-open, 1 open)',
                labelNames: ['provider']
            });
            this.circuitHalfOpenInFlight = new this.client.Gauge({
                name: `${this.prefix}db_circuit_half_open_inflight`,
                help: 'DB circuit half-open in-flight probes',
                labelNames: ['provider']
            });
            this.circuitFailuresGauge = new this.client.Gauge({
                name: `${this.prefix}db_circuit_failures`,
                help: 'DB circuit consecutive failures counter',
                labelNames: ['provider']
            });
        }
    }
    initFallbackMetrics() {
        this.fallbackAttempts = new this.client.Counter({
            name: `${this.prefix}db_fallback_attempts_total`,
            help: 'Total graceful-degradation fallback attempts',
            labelNames: ['provider', 'fallback']
        });
        this.fallbackSuccess = new this.client.Counter({
            name: `${this.prefix}db_fallback_success_total`,
            help: 'Successful graceful-degradation fallbacks',
            labelNames: ['provider', 'fallback']
        });
        this.fallbackFailures = new this.client.Counter({
            name: `${this.prefix}db_fallback_failures_total`,
            help: 'Failed graceful-degradation fallbacks',
            labelNames: ['provider', 'fallback', 'error_type']
        });
        this.fallbackThrottled = new this.client.Counter({
            name: `${this.prefix}db_fallback_throttled_total`,
            help: 'Fallback attempts skipped due to throttling',
            labelNames: ['provider']
        });
        this.hedgedWins = new this.client.Counter({
            name: `${this.prefix}db_hedged_wins_total`,
            help: 'Hedged requests where fallback beat primary',
            labelNames: ['provider', 'operation', 'fallback']
        });
    }
    queryStart(_info) { }
    queryEnd(info) {
        if (!this.enabled || !this.client || !this.queryTotal || !this.queryDuration)
            return;
        const sql = this.maskIfNeeded(info.sql);
        const op = this.parseOperation(sql);
        const entity = this.parseEntity(sql) || 'unknown';
        const provider = info.provider || 'unknown';
        const success = info.error ? 'false' : 'true';
        const labels = { provider, operation: op, entity, success };
        try {
            this.queryTotal.labels(labels).inc(1);
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
        catch { }
    }
    retry(info) {
        if (!this.enabled || !this.client || !this.retryTotal)
            return;
        const sql = this.maskIfNeeded(info.sql);
        const op = this.parseOperation(sql);
        const entity = this.parseEntity(sql) || 'unknown';
        const provider = info.provider || 'unknown';
        try {
            this.retryTotal.labels({ provider, operation: op, entity }).inc(1);
        }
        catch { }
    }
    transactionStart(info) {
        if (this.enabled && this.activeTransactions) {
            try {
                this.activeTransactions.inc({ provider: info.provider || 'unknown' }, 1);
            }
            catch { }
        }
    }
    transactionEnd(info) {
        if (this.enabled && this.activeTransactions) {
            try {
                this.activeTransactions.dec({ provider: info.provider || 'unknown' }, 1);
            }
            catch { }
        }
    }
    cache(info) {
        if (!this.enabled || !this.client)
            return;
        const provider = info.provider || 'unknown';
        try {
            if (info.hit)
                this.cacheHits?.labels({ cache: info.cache, provider }).inc(1);
            else
                this.cacheMisses?.labels({ cache: info.cache, provider }).inc(1);
            if (info.cache === 'count') {
                if (info.hit && info.ttl === true)
                    this.countCacheTtlHits?.labels({ provider }).inc(1);
                if (info.hit && info.ttl === false)
                    this.countCacheHardHits?.labels({ provider }).inc(1);
            }
        }
        catch { }
    }
    cacheSize(info) {
        if (!this.enabled || !this.cacheSizeGauge)
            return;
        try {
            this.cacheSizeGauge?.set?.({ cache: info.cache, provider: info.provider || 'unknown' }, info.size);
        }
        catch { }
    }
    cacheEvicted(info) {
        if (!this.enabled || !this.cacheEvictions)
            return;
        try {
            this.cacheEvictions
                .labels({ cache: info.cache, provider: info.provider || 'unknown' })
                .inc(1);
        }
        catch { }
    }
    hedgedWin(info) {
        if (!this.enabled || !this.client || !this.hedgedWins)
            return;
        try {
            this.hedgedWins
                .labels({
                provider: info.provider || 'unknown',
                operation: info.operation,
                fallback: info.fallback
            })
                .inc(1);
        }
        catch { }
    }
    connectionHealth(info) {
        if (!this.enabled || (!this.connectionHealthGauge && !this.connectionLatency))
            return;
        const provider = info.provider || 'unknown';
        const status = info.status || (info.healthy ? 'healthy' : 'unhealthy');
        this.setHealthGauge(provider, status, info.healthy);
        this.observeHealthLatency(provider, status, info.latencyMs);
        this.setDegradedGauge(provider, status);
        this.recordStatusTransition(provider, status);
    }
    circuit(info) {
        if (!this.enabled || !this.client)
            return;
        const provider = info.provider || 'unknown';
        try {
            const prev = this.lastConnectionStatus.get(`circuit:${provider}`);
            if (prev && prev !== info.state) {
                this.circuitTransitions?.labels({ provider, from: prev, to: info.state }).inc(1);
            }
            this.lastConnectionStatus.set(`circuit:${provider}`, info.state);
            if (info.state === 'open') {
                const reason = info.reason || 'unknown';
                this.circuitOpenTotal?.labels({ provider, reason }).inc(1);
            }
            // state gauge
            const v = info.state === 'open' ? 1 : info.state === 'half-open' ? 0.5 : 0;
            this.circuitStateGauge?.set?.({ provider }, v);
            if (typeof info.halfOpenInFlight === 'number') {
                this.circuitHalfOpenInFlight?.set?.({ provider }, info.halfOpenInFlight);
            }
            if (typeof info.failures === 'number') {
                this.circuitFailuresGauge?.set?.({ provider }, info.failures);
            }
        }
        catch { }
    }
    fallback(info) {
        if (!this.enabled || !this.client)
            return;
        const provider = info.provider || 'unknown';
        try {
            if (info.throttled) {
                this.fallbackThrottled?.labels({ provider }).inc(1);
                return;
            }
            if (info.attempted)
                this.fallbackAttempts?.labels({ provider, fallback: info.fallback }).inc(1);
            if (info.succeeded === true) {
                this.fallbackSuccess?.labels({ provider, fallback: info.fallback }).inc(1);
            }
            else if (info.succeeded === false) {
                const errType = info.error?.name || 'Error';
                this.fallbackFailures
                    ?.labels({ provider, fallback: info.fallback, error_type: errType })
                    .inc(1);
            }
        }
        catch { }
    }
    setHealthGauge(provider, status, healthy) {
        try {
            if (this.connectionHealthGauge) {
                this.connectionHealthGauge.set?.({ provider, status }, healthy ? 1 : 0);
            }
        }
        catch { }
    }
    observeHealthLatency(provider, status, latencyMs) {
        try {
            if (this.connectionLatency && typeof latencyMs === 'number') {
                this.connectionLatency.labels({ provider, status }).observe(Math.max(0, latencyMs));
            }
        }
        catch { }
    }
    setDegradedGauge(provider, status) {
        try {
            if (this.connectionDegradedGauge) {
                this.connectionDegradedGauge.set?.({ provider }, status === 'degraded' ? 1 : 0);
            }
        }
        catch { }
    }
    recordStatusTransition(provider, status) {
        try {
            if (!this.connectionStatusTransitions)
                return;
            const prev = this.lastConnectionStatus.get(provider);
            if (prev && prev !== status) {
                this.connectionStatusTransitions.labels({ provider, from: prev, to: status }).inc(1);
            }
            this.lastConnectionStatus.set(provider, status);
        }
        catch { }
    }
    safeRequirePromClient() {
        try {
            const pc = require('prom-client');
            if (pc && pc.Counter && pc.Histogram)
                return pc;
        }
        catch { }
        return undefined;
    }
    maskIfNeeded(sql) {
        if (!this.maskSql)
            return sql;
        let s = sql;
        // redact single- and double-quoted strings using safe regexps (no unmatched groups)
        s = s.replace(/'(?:[^']|''+)*'/g, "'[REDACTED]'").replace(/"(?:[^"\\]|\\.)*"/g, '"[REDACTED]"');
        for (const re of this.maskPatterns) {
            try {
                s = s.replace(re, '[REDACTED]');
            }
            catch { }
        }
        return s;
    }
    parseOperation(sql) {
        const m = sql.trim().match(/^(SELECT|INSERT|UPDATE|DELETE)\b/i);
        return m ? m[1].toUpperCase() : 'OTHER';
    }
    parseEntity(sql) {
        const up = sql.toUpperCase();
        let m = up.match(/\bFROM\s+([A-Z0-9_"`\[\]]+)/);
        if (m && m[1])
            return this.cleanIdentifier(m[1]);
        m = up.match(/\bINTO\s+([A-Z0-9_"`\[\]]+)/);
        if (m && m[1])
            return this.cleanIdentifier(m[1]);
        m = up.match(/^UPDATE\s+([A-Z0-9_"`\[\]]+)/);
        if (m && m[1])
            return this.cleanIdentifier(m[1]);
        return undefined;
    }
    cleanIdentifier(id) {
        return id.replace(/^["`\[]|["`\]]$/g, '');
    }
}
//# sourceMappingURL=PrometheusSqlLogger.js.map