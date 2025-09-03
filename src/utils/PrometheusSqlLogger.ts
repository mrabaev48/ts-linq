import { SqlLogger } from '../types';

type LabelValues = Record<string, string>;

/** Minimal shape we rely on from prom-client. */
interface PromCounter {
    labels(labels: LabelValues): { inc: (v?: number) => void };
}
interface PromHistogram {
    labels(labels: LabelValues): { observe: (v: number, exemplar?: any) => void };
}
interface PromClientLike {
    Counter: new (cfg: any) => PromCounter;
    Histogram: new (cfg: any) => PromHistogram;
    Gauge?: new (cfg: any) => { inc: (labels?: LabelValues, v?: number) => void; dec: (labels?: LabelValues, v?: number) => void };
}

/**
 * Options for configuring PrometheusSqlLogger.
 *
 * - prefix: optional metric name prefix (e.g., "tsl_")
 * - bucketsMs: custom histogram buckets in milliseconds
 * - client: optional prom-client compatible object for DI/testing; if omitted, logger lazy-requires 'prom-client'
 */
export interface PrometheusLoggerOptions {
    /** Metric names prefix, e.g., "tsl_". */
    prefix?: string;
    /** Histogram buckets (ms) for query duration metric. */
    bucketsMs?: number[];
    /** Prometheus client to use; when omitted a lazy require('prom-client') is attempted. */
    client?: PromClientLike; // for tests/mocking; if omitted we lazy-require('prom-client')
}

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
export class PrometheusSqlLogger implements SqlLogger {
    private enabled: boolean = false;
    private prefix: string;
    private client?: PromClientLike;
    private queryTotal?: PromCounter;
    private queryDuration?: PromHistogram;
    private errorTotal?: PromCounter;
    private retryTotal?: PromCounter;
    private activeTransactions?: { inc: (labels?: LabelValues, v?: number) => void; dec: (labels?: LabelValues, v?: number) => void };
    private cacheHits?: PromCounter;
    private cacheMisses?: PromCounter;

    /**
     * Create a new PrometheusSqlLogger.
     * @param namespace Logical service name (reserved for future labels/exemplars).
     * @param options Optional configuration for metric prefix, buckets and DI client.
     */
    constructor(namespace: string, options?: PrometheusLoggerOptions) {
        this.prefix = options?.prefix ?? '';
        this.client = options?.client ?? this.safeRequirePromClient();
        if (!this.client) return;
        this.enabled = true;
        const buckets = options?.bucketsMs ?? [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
        const labelNames = ['provider', 'operation', 'entity', 'success'];
        this.queryTotal = new this.client.Counter({ name: `${this.prefix}db_query_total`, help: 'Total DB queries', labelNames });
        this.queryDuration = new this.client.Histogram({ name: `${this.prefix}db_query_duration_ms`, help: 'DB query duration (ms)', labelNames, buckets });
        this.errorTotal = new this.client.Counter({ name: `${this.prefix}db_error_total`, help: 'Total DB errors', labelNames: ['provider', 'operation', 'entity', 'error_type'] });
        this.retryTotal = new this.client.Counter({ name: `${this.prefix}db_retry_total`, help: 'Total DB retry attempts', labelNames: ['provider', 'operation', 'entity'] });
        if (this.client.Gauge) {
            const g = new this.client.Gauge({ name: `${this.prefix}db_active_transactions`, help: 'Active DB transactions', labelNames: ['provider'] });
            this.activeTransactions = {
                inc: (labels?: LabelValues, v?: number) => { try { (g as any).inc(labels, v); } catch { /* ignore */ } },
                dec: (labels?: LabelValues, v?: number) => { try { (g as any).dec(labels, v); } catch { /* ignore */ } }
            };
        }
        // optional cache metrics (off by default unless used)
        this.cacheHits = new this.client.Counter({ name: `${this.prefix}db_cache_hits_total`, help: 'DB cache hits', labelNames: ['cache', 'provider'] });
        this.cacheMisses = new this.client.Counter({ name: `${this.prefix}db_cache_misses_total`, help: 'DB cache misses', labelNames: ['cache', 'provider'] });
    }

    /** No-op (metrics are recorded on queryEnd). */
    public queryStart(_info?: { sql: string; params: any[]; traceId?: string; provider?: string }): void {
        // Intentionally empty: we record on queryEnd with duration.
    }

    /** Record query counters and durations, and errors if present. */
    public queryEnd(info: { sql: string; params: any[]; durationMs: number; traceId?: string; rows?: number; error?: Error; provider?: string }): void {
        if (!this.enabled || !this.client || !this.queryTotal || !this.queryDuration) return;
        const op = this.parseOperation(info.sql);
        const entity = this.parseEntity(info.sql) || 'unknown';
        const provider = info.provider || 'unknown';
        const success = info.error ? 'false' : 'true';
        const labels = { provider, operation: op, entity, success } as LabelValues;
        try {
            this.queryTotal.labels(labels).inc(1);
            // Attach exemplar when traceId is present and prom-client supports it
            const duration = Math.max(0, info.durationMs);
            try {
                (this.queryDuration.labels(labels) as any).observe(duration, info.traceId ? { traceId: info.traceId } : undefined);
            } catch {
                this.queryDuration.labels(labels).observe(duration as any);
            }
            if (info.error && this.errorTotal) {
                const errLabels = { provider, operation: op, entity, error_type: info.error.name || 'Error' } as LabelValues;
                this.errorTotal.labels(errLabels).inc(1);
            }
        } catch { /* swallow metric errors */ }
    }

    /** Record a retry attempt. */
    public retry?(info: { sql: string; params: any[]; attempt: number; traceId?: string; provider?: string }): void {
        if (!this.enabled || !this.client || !this.retryTotal) return;
        const op = this.parseOperation(info.sql);
        const entity = this.parseEntity(info.sql) || 'unknown';
        const provider = info.provider || 'unknown';
        try {
            this.retryTotal.labels({ provider, operation: op, entity }).inc(1);
        } catch { /* ignore */ }
    }

    /** Track active transactions gauge. */
    public transactionStart?(info: { traceId?: string; provider?: string }): void {
        if (!this.enabled || !this.activeTransactions) return;
        const provider = info.provider || 'unknown';
        try { this.activeTransactions.inc({ provider }, 1); } catch { /* ignore */ }
    }
    public transactionEnd?(info: { traceId?: string; provider?: string }): void {
        if (!this.enabled || !this.activeTransactions) return;
        const provider = info.provider || 'unknown';
        try { this.activeTransactions.dec({ provider }, 1); } catch { /* ignore */ }
    }

    /** Cache hit/miss hook. */
    public cache?(info: { cache: 'sqlGen' | 'entityL2' | 'count'; hit: boolean; provider?: string }): void {
        if (!this.enabled || !this.client) return;
        const provider = info.provider || 'unknown';
        try {
            if (info.hit) this.cacheHits?.labels({ cache: info.cache, provider } as any).inc(1);
            else this.cacheMisses?.labels({ cache: info.cache, provider } as any).inc(1);
        } catch { /* ignore */ }
    }

    private safeRequirePromClient(): PromClientLike | undefined {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const pc = require('prom-client');
            if (pc && pc.Counter && pc.Histogram) {
                return pc as PromClientLike;
            }
        } catch { /* not installed */ }
        return undefined;
    }

    private parseOperation(sql: string): string {
        const m = sql.trim().match(/^(SELECT|INSERT|UPDATE|DELETE)\b/i);
        return (m ? m[1].toUpperCase() : 'OTHER');
    }

    private parseEntity(sql: string): string | undefined {
        const up = sql.toUpperCase();
        // FROM table or INTO table
        let m = up.match(/\bFROM\s+([A-Z0-9_"`\[\]]+)/);
        if (m && m[1]) return this.cleanIdentifier(m[1]);
        m = up.match(/\bINTO\s+([A-Z0-9_"`\[\]]+)/);
        if (m && m[1]) return this.cleanIdentifier(m[1]);
        // UPDATE table SET
        m = up.match(/^UPDATE\s+([A-Z0-9_"`\[\]]+)/);
        if (m && m[1]) return this.cleanIdentifier(m[1]);
        return undefined;
    }

    private cleanIdentifier(id: string): string {
        return id.replace(/^["`\[]|["`\]]$/g, '');
    }
}


