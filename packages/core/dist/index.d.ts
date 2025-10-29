/**
 * Core ORM exports - types, decorators, metadata, context, query building,
 * change tracking, loading utilities, and base provider abstractions.
 */
export { EntityState, CircuitOpenError, type TrackedEntity, type DbContextOptions, type CircuitState, type CircuitBreakerOptions, type MemorySampleInfo, type MemoryProfilerLike, type DiagnosticsOptions, type LoadingOptions, type QueryResult, type AggregateResult, type PrimaryKeyOf, type ConnectionHealthStatus, type QueryStartInfo, type QueryEndInfo, type RetryInfo, type TransactionInfo, type CacheInfo, type ConnectionHealthInfo, type CircuitEventInfo, type FallbackInfo, type RetryDecisionInfo, type QueryPerformanceAnalysisOptions, type QueryAnalysisInfo } from './types';
export * from './decorators/Entity';
export * from './decorators/Column';
export * from './decorators/PrimaryKey';
export * from './decorators/Relationships';
export * from './decorators/ValidIf';
export * from './decorators/CachePolicy';
export * from './DatabaseProvider';
export * from './DdlStrategy';
export * from './DdlBuilder';
export * from './loading/LoadingStrategy';
export * from './loading/EntityLoader';
export * from './loading/LazyLoadingProxy';
export * from './utils/SqlHelper';
export * from './utils/RetryPolicies';
export * from './utils/EntityCache';
export * from './utils/PrometheusEndpoint';
//# sourceMappingURL=index.d.ts.map