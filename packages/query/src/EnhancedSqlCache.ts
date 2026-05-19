import type { SqlCache, SqlCacheEntry } from '@ts-linq/types';

import { LruCache } from './LruCache';
import { type EnhancedCacheMetrics, MetricsCacheDecorator } from './MetricsCacheDecorator';
import { TtlCacheDecorator } from './TtlCacheDecorator';

/**
 * @deprecated Internal detail — kept for backward compatibility.
 * TTL and access metadata are now owned by TtlCacheDecorator and LruCache respectively.
 */
export interface EnhancedSqlCacheEntry extends SqlCacheEntry {
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  ttl: number;
}

/** Configuration options for EnhancedSqlCache. */
export interface EnhancedSqlCacheOptions {
  /** Maximum number of entries before eviction starts (default: 2000). */
  maxSize?: number;
  /** Default TTL in milliseconds. 0 = no expiration (default: 300000 in prod, 0 in test). */
  defaultTtl?: number;
  /** Enable LRU eviction instead of FIFO (default: true). */
  enableLru?: boolean;
  /** Enable SHA-256 key compression for long keys (default: true). */
  enableKeyCompression?: boolean;
  /** Minimum key length (chars) to trigger compression (default: 200). */
  compressionThreshold?: number;
  /** Enable detailed metrics tracking (default: true). */
  enableMetrics?: boolean;
  /** Batch size for warm() (default: 50). */
  warmingBatchSize?: number;
}

/** Cache performance metrics snapshot (backward-compatible alias). */
export type SqlCacheMetrics = EnhancedCacheMetrics;

function resolveDefaults(options: EnhancedSqlCacheOptions): Required<EnhancedSqlCacheOptions> {
  const isTestEnv =
    typeof process !== 'undefined' &&
    (process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test');

  return {
    maxSize: options.maxSize ?? 2000,
    defaultTtl: options.defaultTtl ?? (isTestEnv ? 0 : 300_000),
    enableLru: options.enableLru ?? true,
    enableKeyCompression: options.enableKeyCompression ?? true,
    compressionThreshold: options.compressionThreshold ?? 200,
    enableMetrics: options.enableMetrics ?? true,
    warmingBatchSize: options.warmingBatchSize ?? 50
  };
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function initZeroMetrics(): SqlCacheMetrics {
  return {
    totalRequests: 0,
    hits: 0,
    misses: 0,
    hitRatio: 0,
    evictions: 0,
    expirations: 0,
    currentSize: 0,
    averageAccessCount: 0,
    estimatedMemoryUsage: 0
  };
}

/**
 * Factory/facade that composes LruCache, TtlCacheDecorator, and MetricsCacheDecorator
 * into a fully-featured SQL cache.
 *
 * Decoration chain (outermost → innermost):
 *   TtlCacheDecorator → MetricsCacheDecorator → LruCache
 *
 * @remarks
 * Call `dispose()` when done to stop the background cleanup timer and free resources.
 * @internal
 */
export class EnhancedSqlCache implements SqlCache {
  private readonly _lru: LruCache;
  private readonly _ttl: TtlCacheDecorator;
  private readonly _metrics: MetricsCacheDecorator | undefined;
  private readonly _outer: SqlCache;
  private readonly _warmingBatchSize: number;

  constructor(options: EnhancedSqlCacheOptions = {}) {
    const opts = resolveDefaults(options);
    this._warmingBatchSize = opts.warmingBatchSize;

    // Layer 1: LRU store (innermost — owns entries)
    this._lru = new LruCache({
      maxSize: opts.maxSize,
      enableLru: opts.enableLru,
      enableKeyCompression: opts.enableKeyCompression,
      compressionThreshold: opts.compressionThreshold
    });

    let current: SqlCache = this._lru;

    // Layer 2: Metrics — sits between LRU and TTL so it observes all get/set/invalidate calls
    if (opts.enableMetrics) {
      this._metrics = new MetricsCacheDecorator(current);
      current = this._metrics;
    }

    // Layer 3: TTL (outermost — intercepts get() for lazy expiry, owns the cleanup timer)
    this._ttl = new TtlCacheDecorator(current, opts.defaultTtl);
    this._outer = this._ttl;
  }

  // ─── SqlCache interface ────────────────────────────────────────────────────

  get(key: string): SqlCacheEntry | undefined {
    return this._outer.get(key);
  }

  set(key: string, value: SqlCacheEntry): void {
    this._outer.set(key, value);
  }

  invalidateBy(matcher: (key: string) => boolean): number {
    return this._outer.invalidateBy?.(matcher) ?? 0;
  }

  clear(): void {
    this._outer.clear();
  }

  size(): number {
    return this._outer.size();
  }

  // ─── Extended API (backward compatible) ───────────────────────────────────

  /** Returns comprehensive cache metrics. Always returns a valid object even when metrics are disabled. */
  getMetrics(): SqlCacheMetrics {
    if (!this._metrics) return initZeroMetrics();

    const m = this._metrics.getMetrics();

    // Enrich averageAccessCount from LRU access tracking
    const lruSize = this._lru.size();
    if (lruSize > 0) {
      const top = this._lru.getTopAccessed(lruSize);
      m.averageAccessCount = top.reduce((sum, e) => sum + e.accessCount, 0) / lruSize;
    }

    // Rough memory estimate: 2 bytes/char for query + 20 bytes/param + 64 bytes overhead
    // We can approximate from metrics since we no longer have direct store access here
    m.estimatedMemoryUsage = m.currentSize * 64; // conservative floor

    return m;
  }

  /** Manually expire TTL-exceeded entries. Returns number of entries removed. */
  expireEntries(): number {
    const n = this._ttl.expireEntries();
    if (n > 0 && this._metrics) {
      this._metrics.recordExpirations(n);
    }
    return n;
  }

  /** Pre-populate the cache with frequently used queries, respecting per-entry TTL overrides. */
  warm(entries: Array<{ key: string; value: SqlCacheEntry; ttl?: number }>): void {
    const batches = chunkArray(entries, this._warmingBatchSize);
    for (const batch of batches) {
      for (const entry of batch) {
        this._ttl.setWithTtl(entry.key, entry.value, entry.ttl);
      }
    }
  }

  /** Returns tuning recommendations based on current metrics. */
  getOptimizationInsights(): {
    shouldIncreaseSize: boolean;
    shouldDecreaseTtl: boolean;
    shouldIncreaseTtl: boolean;
    topAccessedEntries: Array<{ key: string; accessCount: number }>;
  } {
    const metrics = this.getMetrics();
    return {
      shouldIncreaseSize: metrics.hitRatio < 0.7 && metrics.evictions > metrics.currentSize * 0.1,
      shouldDecreaseTtl: metrics.expirations > metrics.totalRequests * 0.2,
      shouldIncreaseTtl:
        metrics.hitRatio > 0.95 && metrics.expirations < metrics.totalRequests * 0.05,
      topAccessedEntries: this._lru.getTopAccessed(10)
    };
  }

  /**
   * Stops the background cleanup timer and clears all cached entries.
   * Must be called when the cache is no longer needed to avoid timer leaks.
   */
  dispose(): void {
    this._ttl.dispose();
    this._outer.clear();
  }
}
