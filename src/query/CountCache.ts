export interface CountCacheEntry {
  value: number;
  ts: number;
}

export interface CountCache {
  get(key: string): CountCacheEntry | undefined;
  set(key: string, entry: CountCacheEntry): void;
  clear(): void;
}

/** In-memory CountCache with TTL and max size (FIFO eviction). */
export class InMemoryCountCache implements CountCache {
  private store = new Map<string, CountCacheEntry>();
  constructor(private ttlMs: number = 10_000, private maxSize: number = 2000) {}
  get(key: string): CountCacheEntry | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (this.ttlMs > 0 && Date.now() - hit.ts > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return hit;
  }
  set(key: string, entry: CountCacheEntry): void {
    if (this.store.size >= this.maxSize) {
      const first = this.store.keys().next().value as string | undefined;
      if (first !== undefined) this.store.delete(first);
    }
    this.store.set(key, entry);
  }
  clear(): void {
    this.store.clear();
  }
}
