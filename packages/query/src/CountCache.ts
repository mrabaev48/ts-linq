import type { CountCache } from '@ts-linq/types';

export type { CountCache };

export interface CountCacheEntry {
  value: number;
  ts: number;
}

/**
 * In-memory CountCache with TTL and max size (FIFO eviction).
 * @internal
 */
export class InMemoryCountCache implements CountCache {
  private store = new Map<string, CountCacheEntry>();
  constructor(
    private ttlMs: number = 10_000,
    private maxSize: number = 2000
  ) {}
  get(key: string): number | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (this.ttlMs > 0 && Date.now() - hit.ts > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }
  set(key: string, value: number): void {
    if (this.store.size >= this.maxSize) {
      const first = this.store.keys().next().value;
      if (first !== undefined) this.store.delete(first);
    }
    this.store.set(key, { value, ts: Date.now() });
  }
  clear(): void {
    this.store.clear();
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
