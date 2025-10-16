import type { SqlLogger, SqlParameter } from '@ts-linq/core';
type LabelValues = Record<string, string>;
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
interface PromGauge {
    inc: (labels?: LabelValues, v?: number) => void;
    dec: (labels?: LabelValues, v?: number) => void;
    set?: (labels: LabelValues, v: number) => void;
}
interface PromClientLike {
    Counter: new (cfg: Record<string, unknown>) => PromCounter;
    Histogram: new (cfg: Record<string, unknown>) => PromHistogram;
    Gauge?: new (cfg: Record<string, unknown>) => PromGauge;
}
export interface PrometheusLoggerOptions {
    prefix?: string;
    bucketsMs?: number[];
    client?: PromClientLike;
    /** When true, redact string literals and sensitive patterns from SQL before parsing labels */
    maskSql?: boolean;
    /** Custom patterns to redact from SQL text (replaced by [REDACTED]) */
    maskPatterns?: ReadonlyArray<RegExp>;
}
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
    private connectionHealthGauge?;
    private connectionLatency?;
    private connectionDegradedGauge?;
    private connectionStatusTransitions?;
    private lastConnectionStatus;
    private maskSql;
    private maskPatterns;
    private circuitTransitions?;
    private circuitOpenTotal?;
    private circuitStateGauge?;
    private circuitHalfOpenInFlight?;
    private circuitFailuresGauge?;
    private fallbackAttempts?;
    private fallbackSuccess?;
    private fallbackFailures?;
    private fallbackThrottled?;
    private hedgedWins?;
    constructor(namespace: string, options?: PrometheusLoggerOptions);
    private initQueryMetrics;
    private initCacheMetrics;
    private initHealthMetrics;
    private initCircuitMetrics;
    private initFallbackMetrics;
    queryStart(_info?: {
        sql: string;
        params: readonly SqlParameter[];
        traceId?: string;
        provider?: string;
    }): void;
    queryEnd(info: {
        sql: string;
        params: readonly SqlParameter[];
        durationMs: number;
        traceId?: string;
        rows?: number;
        error?: Error;
        provider?: string;
    }): void;
    retry?(info: {
        sql: string;
        params: readonly SqlParameter[];
        attempt: number;
        traceId?: string;
        provider?: string;
    }): void;
    transactionStart?(info: {
        traceId?: string;
        provider?: string;
    }): void;
    transactionEnd?(info: {
        traceId?: string;
        provider?: string;
    }): void;
    cache?(info: {
        cache: 'sqlGen' | 'entityL2' | 'count';
        hit: boolean;
        provider?: string;
        ttl?: boolean;
    }): void;
    cacheSize?(info: {
        cache: 'sqlGen' | 'entityL2' | 'count';
        size: number;
        provider?: string;
    }): void;
    cacheEvicted?(info: {
        cache: 'sqlGen' | 'entityL2' | 'count';
        provider?: string;
    }): void;
    hedgedWin?(info: {
        provider?: string;
        operation: string;
        fallback: string;
    }): void;
    connectionHealth?(info: {
        healthy: boolean;
        latencyMs?: number;
        provider?: string;
        status?: string;
    }): void;
    circuit?(info: {
        state: 'closed' | 'open' | 'half-open';
        provider?: string;
        failures?: number;
        reason?: string;
        halfOpenInFlight?: number;
    }): void;
    fallback?(info: {
        provider?: string;
        fallback: string;
        attempted: boolean;
        succeeded?: boolean;
        error?: Error;
        throttled?: boolean;
        isStale?: boolean;
        asOf?: number;
        source?: string;
    }): void;
    private setHealthGauge;
    private observeHealthLatency;
    private setDegradedGauge;
    private recordStatusTransition;
    private safeRequirePromClient;
    private maskIfNeeded;
    private parseOperation;
    private parseEntity;
    private cleanIdentifier;
}
export {};
//# sourceMappingURL=PrometheusSqlLogger.d.ts.map