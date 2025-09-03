export interface SqlCacheEntry {
  query: string;
  parameters: any[];
}

export interface SqlCache {
  get(key: string): SqlCacheEntry | undefined;
  set(key: string, value: SqlCacheEntry): void;
  clear(): void;
  size(): number;
}


