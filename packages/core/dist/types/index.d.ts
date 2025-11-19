import type { DatabaseProvider } from '../DatabaseProvider';
/**
 * Core-specific types that don't belong in @ts-linq/types
 */
/** Entity state for change tracking */
export declare enum EntityState {
    Unchanged = "unchanged",
    Added = "added",
    Modified = "modified",
    Deleted = "deleted"
}
/** Internal structure representing a tracked entity and its state */
export interface TrackedEntity {
    entity: object;
    entityClass: Function;
    state: EntityState;
    originalValues?: object;
}
/** Options for constructing a database context */
export interface DbContextOptions {
    provider: DatabaseProvider;
    performance?: import('@ts-linq/types').PerformanceOptions;
    loading?: import('@ts-linq/types').LoadingDefaults;
    softDelete?: import('@ts-linq/types').SoftDeleteOptions;
    audit?: import('@ts-linq/types').AuditOptions;
    globalFilters?: import('@ts-linq/types').GlobalFilter[];
    middlewares?: import('@ts-linq/types').OrmMiddleware[];
    validation?: {
        translate?: (key: string, params?: Record<string, unknown>) => string;
    };
    diagnostics?: DiagnosticsOptions;
}
/** Circuit Breaker finite states */
export type CircuitState = 'closed' | 'open' | 'half-open';
/** Circuit Breaker options */
export interface CircuitBreakerOptions {
    enabled?: boolean;
    failureThreshold?: number;
    openDurationMs?: number;
    maxOpenDurationMs?: number;
    halfOpenMaxCalls?: number;
    countTransientOnly?: boolean;
}
/** Read-only memory sample for diagnostics */
export interface MemorySampleInfo {
    timestampMs: number;
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
    heapPressure: number;
}
/** Minimal profiler contract */
export interface MemoryProfilerLike {
    onSample(listener: (sample: MemorySampleInfo) => void): () => void;
    getAliveAllocations?(): number;
    start?(): void;
    stop?(): void;
    sample?(allowGc?: boolean): Promise<MemorySampleInfo> | MemorySampleInfo;
}
/** Diagnostics hooks and profilers */
export interface DiagnosticsOptions {
    memoryProfiler?: MemoryProfilerLike;
}
/** Options for controlling entity loading behavior */
export interface LoadingOptions {
    strategy?: import('@ts-linq/types').LoadingStrategy;
    includes?: string[];
    depth?: number;
}
/** Query result with metadata */
export interface QueryResult<T> {
    rows: T[];
    totalCount?: number;
    hasMore?: boolean;
}
/** Aggregate result */
export interface AggregateResult {
    count: number;
    sum?: number;
    avg?: number;
    min?: number;
    max?: number;
}
export type PrimaryKeyOf<T> = T extends {
    id: infer K;
} ? K : unknown;
export type ConnectionHealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export interface QueryStartInfo {
    sql: string;
    params: readonly import('@ts-linq/types').SqlParameter[];
    traceId?: string;
    provider?: string;
}
export interface QueryEndInfo {
    sql: string;
    params: readonly import('@ts-linq/types').SqlParameter[];
    durationMs: number;
    traceId?: string;
    rows?: number;
    error?: Error;
    provider?: string;
}
export interface RetryInfo {
    sql: string;
    params: readonly import('@ts-linq/types').SqlParameter[];
    attempt: number;
    traceId?: string;
    provider?: string;
}
export interface TransactionInfo {
    traceId?: string;
    provider?: string;
}
export interface CacheInfo {
    cache: 'sqlGen' | 'entityL2' | 'count';
    hit: boolean;
    provider?: string;
    ttl?: boolean;
}
export interface ConnectionHealthInfo {
    healthy: boolean;
    latencyMs?: number;
    provider?: string;
    status?: ConnectionHealthStatus;
}
export interface CircuitEventInfo {
    state: CircuitState;
    provider?: string;
    failures?: number;
    reason?: string;
    halfOpenInFlight?: number;
}
export interface FallbackInfo {
    provider?: string;
    fallback: string;
    attempted: boolean;
    succeeded?: boolean;
    error?: Error;
    throttled?: boolean;
    isStale?: boolean;
    asOf?: number;
    source?: string;
}
export interface RetryDecisionInfo {
    error: unknown;
    attempt: number;
    inTransaction: boolean;
    sql?: string;
    params?: readonly import('@ts-linq/types').SqlParameter[];
    provider?: string;
}
export interface QueryPerformanceAnalysisOptions {
    enabled?: boolean;
    slowQueryThresholdMs?: number;
    explainThresholdMs?: number;
    recommendations?: boolean;
    sampleRate?: number;
    rateLimitPerMinute?: number;
    explainTimeoutMs?: number;
    maxExplainChars?: number;
    onlySelect?: boolean;
}
export interface QueryAnalysisInfo {
    sql: string;
    params: readonly import('@ts-linq/types').SqlParameter[];
    durationMs: number;
    provider?: string;
    slow?: boolean;
    explainPlan?: unknown;
    recommendations?: ReadonlyArray<string>;
}
export declare class CircuitOpenError extends Error {
    constructor(message?: string);
}
//# sourceMappingURL=index.d.ts.map