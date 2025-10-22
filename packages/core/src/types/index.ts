// Re-export types from @ts-linq/types and @ts-linq/metadata for backwards compatibility
export * from '@ts-linq/types';

import type { SqlCache } from '../query/SqlCache';
import type { CountCache as CountCacheType } from '@ts-linq/types';
import type { EntityCacheLike } from '../utils/EntityCache';
import type { DatabaseProvider } from '../DatabaseProvider';

/**
 * Core-specific types that don't belong in @ts-linq/types
 */

/** Entity state for change tracking */
export enum EntityState {
  Unchanged = 'unchanged',
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted'
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
  loading?: LoadingDefaults;
  softDelete?: import('@ts-linq/types').SoftDeleteOptions;
  audit?: AuditOptions;
  globalFilters?: import('@ts-linq/types').GlobalFilter[];
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

/** Audit stamping feature options */
export interface AuditOptions {
  enabled?: boolean;
  createdAtColumn?: string;
  updatedAtColumn?: string;
  createdByColumn?: string;
  updatedByColumn?: string;
  getCurrentUser?: () => string | number | Promise<string | number>;
}

/** Default loading configuration */
export interface LoadingDefaults {
  strategy?: import('@ts-linq/types').LoadingStrategy;
  maxDepth?: number;
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

// Re-exported for ORM compatibility
export type PrimaryKeyOf<T> = T extends { id: infer K } ? K : unknown;

// Re-export metadata types for backwards compatibility  
export { MetadataStorage } from '@ts-linq/metadata';
export type { EntityMetadata } from '@ts-linq/metadata';
