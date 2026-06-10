/**
 * Core ORM exports - types, decorators, metadata, context, query building,
 * change tracking, loading utilities, and base provider abstractions.
 */

// Backward-compatible re-exports from @ts-linq/types (canonical location for these types)
export type {
  CacheInfo,
  CircuitEventInfo,
  CircuitState,
  ConnectionHealthInfo,
  ConnectionHealthStatus,
  FallbackInfo,
  QueryAnalysisInfo,
  QueryEndInfo,
  QueryStartInfo,
  RetryInfo,
  TrackedEntity,
  TransactionInfo
} from '@ts-linq/types';
export { EntityState } from '@ts-linq/types';

// Core-specific types (tightly coupled to core internals)
export {
  type AggregateResult,
  type CircuitBreakerOptions,
  CircuitOpenError,
  type DbContextOptions,
  type DiagnosticsOptions,
  type IDatabaseProvider,
  type LoadingOptions,
  type MemoryProfilerLike,
  type MemorySampleInfo,
  type PrimaryKeyOf,
  type QueryPerformanceAnalysisOptions,
  type QueryResult,
  type RetryDecisionInfo
} from './types';

// Decorators
export * from './decorators/CachePolicy';
export * from './decorators/Column';
export * from './decorators/Entity';
export * from './decorators/PrimaryKey';
export * from './decorators/Relationships';
export * from './decorators/ValidIf';

// Metadata - moved to @ts-linq/metadata package
// Import from: @ts-linq/metadata

// Change tracking - moved to @ts-linq/orm package
// Import from: @ts-linq/orm

// Context and DbSet - moved to @ts-linq/orm package
// Import from: @ts-linq/orm

// Query building - moved to @ts-linq/query package
// Import from: @ts-linq/query

// Query tracking
export * from './QueryTrackingBehavior';

// Base provider abstractions
export * from './DatabaseProvider';
export * from './DdlBuilder';
export * from './DdlStrategy';
export { ProviderConfig, type ProviderConfigOptions } from './ProviderConfig';
export { AnsiSavepointStrategy, type SavepointStrategy } from './strategies/SavepointStrategy';
export {
  type SequenceExecutionPort,
  type SequenceStrategy,
  UnsupportedSequenceStrategy
} from './strategies/SequenceStrategy';

// Loading
export * from './loading/EntityLoader';
export * from './loading/LazyLoadingProxy';
export * from './loading/LoadingStrategy';

// Migrations - moved to @ts-linq/migrations package
// Import from: @ts-linq/migrations

// Utils
export * from './utils/ctorName';
export * from './utils/EntityCache';
export * from './utils/RetryPolicies';
export * from './utils/SqlHelper';
// export * from './utils/InternalLogger'; // Removed
export * from './utils/PrometheusEndpoint';

// Spatial types
export * from './spatial';

// HierarchyId type
export * from './hierarchy';

// Owned entity hydration utilities
export * from './OwnedEntityHydrator';

// Interceptors
export type { IDbCommandInterceptor } from './interceptors/IDbCommandInterceptor';
export type { IDbConnectionInterceptor } from './interceptors/IDbConnectionInterceptor';
export type { IDbTransactionInterceptor } from './interceptors/IDbTransactionInterceptor';
export type { IMaterializationInterceptor } from './interceptors/IMaterializationInterceptor';
export { InterceptionResult } from './interceptors/InterceptionResult';
export type { ISaveChangesInterceptor } from './interceptors/ISaveChangesInterceptor';
export type {
  CommandEventData,
  ConnectionEventData,
  DbCommand,
  DbReader,
  MaterializationInterceptionData,
  SaveChangesEntry,
  SaveChangesEventData,
  TransactionEventData
} from './interceptors/types';
