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
    constructor(namespace: string, options?: PrometheusLoggerOptions);
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
    private safeRequirePromClient;
    private parseOperation;
    private parseEntity;
    private cleanIdentifier;
}
export {};
//# sourceMappingURL=PrometheusSqlLogger.d.ts.map