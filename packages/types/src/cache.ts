// Cache interfaces, performance options and loading defaults

import type { LoadingStrategy } from './enums';
import type { FallbackPolicy } from './results';
import type { SqlParameter } from './sql';

// Cache metrics
export interface SqlCacheMetrics {
  currentSize: number;
  totalRequests?: number;
  hits?: number;
  misses?: number;
  evictions?: number;
  invalidations?: number;
}

// Count cache interface
export interface CountCache {
  get(key: string): number | undefined;
  set(key: string, value: number): void;
  clear(): void;
  /** Optional targeted invalidation. Should return number of removed entries. */
  invalidateBy?(matcher: (key: string) => boolean): number;
  /** Optional metrics exposure for monitoring. */
  getMetrics?(): Pick<SqlCacheMetrics, 'currentSize'>;
}

// SQL Cache interfaces
export interface SqlCacheEntry {
  query: string;
  parameters: SqlParameter[];
}

export interface SqlCache {
  get(key: string): SqlCacheEntry | undefined;
  set(key: string, value: SqlCacheEntry): void;
  clear(): void;
  size(): number;
  /** Optional targeted invalidation. Should return number of removed entries. */
  invalidateBy?(matcher: (key: string) => boolean): number;
  /** Optional metrics exposure for monitoring. */
  getMetrics?(): SqlCacheMetrics;
}

/**
 * Extended SQL cache interface used by CapturedQueryPlan.
 * Caches SQL templates keyed by query structure (without parameter values),
 * allowing the same SQL to be reused with different bound parameters.
 */
export interface TemplateSqlCache extends SqlCache {
  /** Get cached SQL template by structure-only key. Returns undefined on miss. */
  getTemplate(key: string): { query: string } | undefined;
  /** Number of plan cache hits (SQL template reuses). */
  readonly cacheHits: number;
  /** Number of plan cache misses (SQL generations). */
  readonly cacheMisses: number;
}

// Entity cache interface
export interface EntityCacheLike {
  get<T>(entityClass: Function, id: unknown): T | undefined;
  set<T>(entityClass: Function, id: unknown, entity: T): void;
  remove(entityClass: Function, id: unknown): void;
  clear(): void;
  size?(): number;
}

// Performance options
export interface PerformanceOptions {
  enableQueryCache?: boolean;
  enableCountCache?: boolean;
  enableEntityCache?: boolean;
  queryTimeout?: number;
  countCache?: CountCache;
  countCacheTtlMs?: number;
  sqlCache?: SqlCache;
  cacheNamespace?: string;
  fallbackPolicy?: FallbackPolicy;
  entityCache?: EntityCacheLike;
  entityCacheSize?: number;
  /** Optional IN() chunk size for large value lists. */
  inClauseChunkSize?: number;
  analysis?: Record<string, unknown>;
}

// Cache options
export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
}

// Loading defaults
export interface LoadingDefaults {
  strategy?: LoadingStrategy;
  maxDepth?: number;
  depth?: number;
}

// Additional ORM-related properties
export interface PerformanceOptionsExtended extends PerformanceOptions {
  // Backward compatible alias; all fields live in PerformanceOptions.
}
