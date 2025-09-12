import type { SqlParameter } from '../types';

export interface SqlCacheEntry {
  query: string;
  parameters: SqlParameter[];
}

export interface SqlCache {
  get(key: string): SqlCacheEntry | undefined;
  set(key: string, value: SqlCacheEntry): void;
  clear(): void;
  size(): number;
}

/** Simple in-memory FIFO SqlCache with max size. */
export class InMemorySqlCache implements SqlCache {
  private store = new Map<string, SqlCacheEntry>();
  constructor(private maxSize: number = 1000) {}
  get(key: string): SqlCacheEntry | undefined {
    return this.store.get(key);
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
}
