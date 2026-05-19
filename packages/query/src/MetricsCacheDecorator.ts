import type { SqlCache, SqlCacheEntry } from '@ts-linq/types';

/**
 * Comprehensive cache metrics. Superset of @ts-linq/types SqlCacheMetrics,
 * exported here so EnhancedSqlCache can re-export it as SqlCacheMetrics.
 */
export interface EnhancedCacheMetrics {
  totalRequests: number;
  hits: number;
  misses: number;
  hitRatio: number;
  evictions: number;
  expirations: number;
  currentSize: number;
  averageAccessCount: number;
  estimatedMemoryUsage: number;
}

/**
 * Decorator that adds hit/miss/eviction/expiration metrics to any SqlCache.
 * Single responsibility: observability only — no storage, no TTL, no eviction policy.
 * @internal
 */
export class MetricsCacheDecorator implements SqlCache {
  private totalRequests = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;

  constructor(private readonly inner: SqlCache) {}

  get(key: string): SqlCacheEntry | undefined {
    this.totalRequests++;
    const result = this.inner.get(key);
    if (result !== undefined) {
      this.hits++;
    } else {
      this.misses++;
    }
    return result;
  }

  set(key: string, value: SqlCacheEntry): void {
    // Detect evictions by comparing size before and after inner.set().
    // inner.ensureCapacity() fires before insert, so sizeBefore includes pre-eviction count.
    const sizeBefore = this.inner.size();
    this.inner.set(key, value);
    const sizeAfter = this.inner.size();
    // If net size didn't grow by 1, evictions happened: evicted = sizeBefore + 1 - sizeAfter
    const evicted = Math.max(0, sizeBefore + 1 - sizeAfter);
    this.evictions += evicted;
  }

  invalidateBy(matcher: (key: string) => boolean): number {
    const removed = this.inner.invalidateBy?.(matcher) ?? 0;
    this.evictions += removed;
    return removed;
  }

  clear(): void {
    this.totalRequests = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
    this.inner.clear();
  }

  size(): number {
    return this.inner.size();
  }

  /**
   * Re-classifies n evictions as expirations.
   * Called by EnhancedSqlCache after TtlCacheDecorator.expireEntries() so that
   * TTL-driven removals are counted as expirations, not evictions.
   */
  recordExpirations(count: number): void {
    this.expirations += count;
    this.evictions = Math.max(0, this.evictions - count);
  }

  getMetrics(): EnhancedCacheMetrics {
    const hitRatio = this.totalRequests > 0 ? this.hits / this.totalRequests : 0;
    return {
      totalRequests: this.totalRequests,
      hits: this.hits,
      misses: this.misses,
      hitRatio,
      evictions: this.evictions,
      expirations: this.expirations,
      currentSize: this.inner.size(),
      averageAccessCount: 0, // enriched by EnhancedSqlCache facade via LruCache.getTopAccessed()
      estimatedMemoryUsage: 0 // enriched by EnhancedSqlCache facade if needed
    };
  }
}
