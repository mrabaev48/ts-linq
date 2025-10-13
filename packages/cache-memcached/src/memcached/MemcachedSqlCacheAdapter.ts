import type { SqlCache, SqlCacheEntry } from '@ts-linq/core';

export interface MemjsClientLike {
  get(key: string): Promise<{ value: Buffer | null } | null> | { value: Buffer | null } | null;
  set(
    key: string,
    value: Buffer | string,
    options?: { expires?: number }
  ): Promise<unknown> | unknown;
  delete(key: string): Promise<unknown> | unknown;
}

export interface MemcachedSqlCacheOptions {
  ttlSeconds?: number;
  keyPrefix?: string;
}

export class MemcachedSqlCacheAdapter implements SqlCache {
  private readonly client: MemjsClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly shadow = new Map<string, SqlCacheEntry>();

  constructor(client: MemjsClientLike, options?: MemcachedSqlCacheOptions) {
    this.client = client;
    this.ttlSeconds = options?.ttlSeconds;
    this.keyPrefix = options?.keyPrefix ?? 'tslnq:sql:';
  }

  private k(key: string): string {
    return this.keyPrefix + key;
  }

  private decode(b: Buffer | null): string | null {
    if (!b) return null;
    try {
      return b.toString('utf8');
    } catch {
      return null;
    }
  }

  get(key: string): SqlCacheEntry | undefined {
    return this.shadow.get(key);
  }

  set(key: string, value: SqlCacheEntry): void {
    this.shadow.set(key, { query: value.query, parameters: [...value.parameters] });
    const payload = JSON.stringify({ query: value.query, parameters: value.parameters });
    const options =
      this.ttlSeconds && this.ttlSeconds > 0 ? { expires: this.ttlSeconds } : undefined;
    void this.client.set(this.k(key), payload, options);
  }

  clear(): void {
    this.shadow.clear();
  }

  size(): number {
    return this.shadow.size;
  }
}
