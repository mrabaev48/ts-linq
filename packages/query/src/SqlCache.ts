import type { SqlParameter } from '@ts-linq/types';

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
  getMetrics?(): {
    currentSize: number;
    totalRequests?: number;
    hits?: number;
    misses?: number;
    evictions?: number;
    invalidations?: number;
  };
}

/** Simple in-memory FIFO SqlCache with max size. */
export class InMemorySqlCache implements SqlCache {
  private store = new Map<string, SqlCacheEntry>();
  constructor(private maxSize: number = 1000) {}
  get(key: string): SqlCacheEntry | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    return { query: hit.query, parameters: [...hit.parameters] };
  }
  set(key: string, value: SqlCacheEntry): void {
    if (this.store.size >= this.maxSize) {
      const first = this.store.keys().next().value;
      if (first !== undefined) this.store.delete(first);
    }
    this.store.set(key, { query: value.query, parameters: [...value.parameters] });
  }
  clear(): void {
    this.store.clear();
  }
  size(): number {
    return this.store.size;
  }
  invalidateBy(matcher: (key: string) => boolean): number {
    let removed = 0;
    for (const k of Array.from(this.store.keys())) {
      if (matcher(k)) {
        this.store.delete(k);
        removed++;
      }
    }
    return removed;
  }
}
