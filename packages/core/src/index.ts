/**
 * Core ORM exports - types, decorators, metadata, context, query building,
 * change tracking, loading utilities, and base provider abstractions.
 */

// Backward-compatible re-exports from @ts-linq/types (canonical location for these types)
export { EntityState } from '@ts-linq/types';
export type {
  TrackedEntity,
  ConnectionHealthStatus,
  CircuitState,
  QueryStartInfo,
  QueryEndInfo,
  RetryInfo,
  TransactionInfo,
  CacheInfo,
  ConnectionHealthInfo,
  CircuitEventInfo,
  FallbackInfo,
  QueryAnalysisInfo,
} from '@ts-linq/types';

// Core-specific types (tightly coupled to core internals)
export {
  CircuitOpenError,
  type DbContextOptions,
  type CircuitBreakerOptions,
  type MemorySampleInfo,
  type MemoryProfilerLike,
  type DiagnosticsOptions,
  type LoadingOptions,
  type QueryResult,
  type AggregateResult,
  type PrimaryKeyOf,
  type RetryDecisionInfo,
  type QueryPerformanceAnalysisOptions,
  type IDatabaseProvider,
} from './types';

// Decorators
export * from './decorators/Entity';
export * from './decorators/Column';
export * from './decorators/PrimaryKey';
export * from './decorators/Relationships';
export * from './decorators/ValidIf';
export * from './decorators/CachePolicy';

// Metadata - moved to @ts-linq/metadata package
// Import from: @ts-linq/metadata

// Change tracking - moved to @ts-linq/orm package  
// Import from: @ts-linq/orm

// Context and DbSet - moved to @ts-linq/orm package
// Import from: @ts-linq/orm

// Query building - moved to @ts-linq/query package
// Import from: @ts-linq/query

// Base provider abstractions
export * from './DatabaseProvider';
export * from './DdlStrategy';
export * from './DdlBuilder';

// Loading
export * from './loading/LoadingStrategy';
export * from './loading/EntityLoader';
export * from './loading/LazyLoadingProxy';

// Migrations - moved to @ts-linq/migrations package
// Import from: @ts-linq/migrations

// Utils
export * from './utils/SqlHelper';
export * from './utils/RetryPolicies';
export * from './utils/EntityCache';
export * from './utils/ctorName';
// export * from './utils/InternalLogger'; // Removed
export * from './utils/PrometheusEndpoint';
