/**
 * Public API surface of `@ts-linq/core`.
 *
 * The core runtime: the abstract `DatabaseProvider`, mapping decorators, relationship
 * loading, owned-entity hydration, interceptor interfaces, DDL helpers, spatial/hierarchy
 * value objects, and base resilience utilities.
 *
 * This barrel is curated: every public symbol is exported explicitly so the surface
 * evolves intentionally (a new symbol added to a sub-module does not silently become
 * public API). The only `export *` re-exports are the fully-public value-object barrels
 * (`./spatial`, `./hierarchy`), whose every member is part of the public API.
 *
 * Functionality that used to live here now ships from sibling packages:
 * - metadata (`MetadataStorage`, `MetadataRegistry`, ...) → `@ts-linq/metadata`
 * - change tracking, `DbContext`, `DbSet` → `@ts-linq/orm`
 * - query building → `@ts-linq/query`
 * - migrations → `@ts-linq/migrations`
 */

/**
 * Backward-compatible re-exports from `@ts-linq/types` (the canonical location).
 *
 * @deprecated Import these from `@ts-linq/types` instead — they are re-exported here only
 * for backward compatibility and will be removed in a future major.
 */
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
/**
 * @deprecated Import `EntityState` from `@ts-linq/types` instead — re-exported here only
 * for backward compatibility and will be removed in a future major.
 */
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
export { CachePolicy, type CachePolicyOptions, getCachePolicy } from './decorators/CachePolicy';
export { Column, type ColumnOptions } from './decorators/Column';
export { Entity, type EntityOptions } from './decorators/Entity';
export { PrimaryKey, type PrimaryKeyOptions } from './decorators/PrimaryKey';
export {
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  type RelationshipOptions
} from './decorators/Relationships';
export {
  type EntityPredicate,
  MaxLengthOf,
  MinLengthOf,
  PatternOf,
  RangeOf,
  RequiredIfOf,
  ValidIf,
  ValidIfOf
} from './decorators/ValidIf';

// Query tracking
export { QueryTrackingBehavior } from './QueryTrackingBehavior';

// Base provider abstractions
export { DatabaseProvider } from './DatabaseProvider';
export { DdlBuilder } from './DdlBuilder';
export type { DdlStrategy } from './DdlStrategy';
export { ProviderConfig, type ProviderConfigOptions } from './ProviderConfig';
export { AnsiSavepointStrategy, type SavepointStrategy } from './strategies/SavepointStrategy';
export {
  type SequenceExecutionPort,
  type SequenceStrategy,
  UnsupportedSequenceStrategy
} from './strategies/SequenceStrategy';

// Loading
export { EntityLoader } from './loading/EntityLoader';
export {
  awaitLazyLoad,
  getLazyTarget,
  isLazyProxy,
  LAZY_LOADING_PROVIDER,
  LAZY_LOADING_PROXY,
  LAZY_LOADING_STATE,
  LAZY_LOADING_TARGET,
  type LazyLoadingLogger,
  LazyLoadingProxy
} from './loading/LazyLoadingProxy';
export { LoadingStrategy } from './loading/LoadingStrategy';

// Utils
export { coerceParameterValue } from './utils/coerceParameterValue';
export { ctorName } from './utils/ctorName';
export { EntityCache } from './utils/EntityCache';
export { getPrometheusMetrics, startPrometheusServer } from './utils/PrometheusEndpoint';
// Backward-compat facade: the canonical home of these retry policies is `@ts-linq/concurrency`.
export {
  type ExponentialBackoffOptions,
  ExponentialBackoffRetryPolicy,
  FixedIntervalRetryPolicy,
  NoRetryPolicy
} from './utils/RetryPolicies';
export { SqlHelper } from './utils/SqlHelper';

// Spatial value objects — every member of this sub-barrel is public API.
export * from './spatial';

// HierarchyId value object — curated sub-barrel (`export { HierarchyId }`).
export * from './hierarchy';

// Owned entity hydration utilities (file-local helpers stay unexported)
export { hydrateJson, hydrateOwnedEntities, hydrateTableSplit } from './OwnedEntityHydrator';

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
