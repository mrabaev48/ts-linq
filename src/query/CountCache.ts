export interface CountCacheEntry {
  value: number;
  ts: number;
}

export interface CountCache {
  get(key: string): CountCacheEntry | undefined;
  set(key: string, entry: CountCacheEntry): void;
  clear(): void;
}
