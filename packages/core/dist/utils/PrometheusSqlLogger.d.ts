import type { SqlLogger, SqlParameter } from '../types';
type LabelValues = Record<string, string>;
/** Minimal shape we rely on from prom-client. */
interface PromCounter {
    labels(labels: LabelValues): {
        inc: (v?: number) => void;
    };
}
interface PromHistogram {
    labels(labels: LabelValues): {
        observe: (v: number, exemplar?: Record<string, unknown>) => void;
    };
}
interface PromClientLike {
    Counter: new (cfg: Record<string, unknown>) => PromCounter;
    Histogram: new (cfg: Record<string, unknown>) => PromHistogram;
    Gauge?: new (cfg: Record<string, unknown>) => PromGauge;
}
interface PromGauge {
    inc: (labels?: LabelValues, v?: number) => void;
    dec: (labels?: LabelValues, v?: number) => void;
    set?: (labels: LabelValues, v: number) => void;
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
    client?: PromClientLike;
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
export declare class PrometheusSqlLogger implements SqlLogger {
    private enabled;
    private prefix;
    private client?;
    private queryTotal?;
    private queryDuration?;
    private errorTotal?;
    private retryTotal?;
    private activeTransactions?;
    private cacheHits?;
    private cacheMisses?;
    private cacheSizeGauge?;
    private countCacheTtlHits?;
    private countCacheHardHits?;
    private cacheEvictions?;
    /**
     * Create a new PrometheusSqlLogger.
     * @param namespace Logical service name (reserved for future labels/exemplars).
     * @param options Optional configuration for metric prefix, buckets and DI client.
     */
    constructor(namespace: string, options?: PrometheusLoggerOptions);
    /** No-op (metrics are recorded on queryEnd). */
    queryStart(_info?: {
        sql: string;
        params: readonly SqlParameter[];
        traceId?: string;
        provider?: string;
    }): void;
    /** Record query counters and durations, and errors if present. */
    queryEnd(info: {
        sql: string;
        params: readonly SqlParameter[];
        durationMs: number;
        traceId?: string;
        rows?: number;
        error?: Error;
        provider?: string;
    }): void;
    /** Record a retry attempt. */
    retry?(info: {
        sql: string;
        params: readonly SqlParameter[];
        attempt: number;
        traceId?: string;
        provider?: string;
    }): void;
    /** Track active transactions gauge. */
    transactionStart?(info: {
        traceId?: string;
        provider?: string;
    }): void;
    transactionEnd?(info: {
        traceId?: string;
        provider?: string;
    }): void;
    /** Cache hit/miss hook. */
    cache?(info: {
        cache: 'sqlGen' | 'entityL2' | 'count';
        hit: boolean;
        provider?: string;
    }): void;
    /** Cache size setter (optional API, used via duck typing). */
    cacheSize?(info: {
        cache: 'sqlGen' | 'entityL2' | 'count';
        size: number;
        provider?: string;
    }): void;
    /** Eviction counter (optional API, used via duck typing). */
    cacheEvicted?(info: {
        cache: 'sqlGen' | 'entityL2' | 'count';
        provider?: string;
    }): void;
    private safeRequirePromClient;
    private parseOperation;
    private parseEntity;
    private cleanIdentifier;
}
export {};
//# sourceMappingURL=PrometheusSqlLogger.d.ts.map