import type { SqlCache, SqlCacheEntry } from '@ts-linq/types';

/**
 * Decorator that adds TTL expiry to any SqlCache implementation.
 * Owns the periodic cleanup timer — callers must call dispose() to stop it.
 * @internal
 */
export class TtlCacheDecorator implements SqlCache {
  private ttlMap = new Map<string, number>(); // originalKey → expiresAt (absolute ms)
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly inner: SqlCache,
    private readonly defaultTtl: number
  ) {
    if (defaultTtl > 0) {
      this.startPeriodicCleanup();
    }
  }

  get(key: string): SqlCacheEntry | undefined {
    const expiresAt = this.ttlMap.get(key);
    if (expiresAt !== undefined && Date.now() > expiresAt) {
      this.ttlMap.delete(key);
      this.inner.invalidateBy?.((k) => k === key);
      return undefined;
    }
    return this.inner.get(key);
  }

  set(key: string, value: SqlCacheEntry): void {
    this.setWithTtl(key, value, this.defaultTtl);
  }

  /** Allows per-entry TTL override — used by EnhancedSqlCache.warm(). */
  setWithTtl(key: string, value: SqlCacheEntry, customTtl?: number): void {
    const ttl = customTtl ?? this.defaultTtl;
    if (ttl > 0) {
      this.ttlMap.set(key, Date.now() + ttl);
    } else {
      this.ttlMap.delete(key);
    }
    this.inner.set(key, value);
  }

  /** Scans ttlMap, removes expired entries from both maps and the inner cache. */
  expireEntries(): number {
    const now = Date.now();
    const expiredKeys = new Set<string>();

    for (const [key, expiresAt] of this.ttlMap) {
      if (now > expiresAt) {
        expiredKeys.add(key);
      }
    }

    if (expiredKeys.size === 0) return 0;

    for (const key of expiredKeys) {
      this.ttlMap.delete(key);
    }

    this.inner.invalidateBy?.((k) => expiredKeys.has(k));
    return expiredKeys.size;
  }

  invalidateBy(matcher: (key: string) => boolean): number {
    for (const key of Array.from(this.ttlMap.keys())) {
      if (matcher(key)) this.ttlMap.delete(key);
    }
    return this.inner.invalidateBy?.(matcher) ?? 0;
  }

  clear(): void {
    this.ttlMap.clear();
    this.inner.clear();
  }

  size(): number {
    return this.inner.size();
  }

  /**
   * Stops the periodic cleanup timer.
   * Does NOT clear the inner cache — the facade is responsible for data lifecycle.
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  private startPeriodicCleanup(): void {
    const interval = Math.max(this.defaultTtl / 4, 60_000);
    this.cleanupInterval = setInterval(() => {
      this.expireEntries();
    }, interval);

    const maybe = this.cleanupInterval as unknown as { unref?: () => void } | undefined;
    maybe?.unref?.();
  }
}
