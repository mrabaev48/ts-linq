import type { SqlCache, SqlCacheEntry } from '@ts-linq/core';

export interface RedisClientLike {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<unknown> | unknown;
  del(key: string): Promise<unknown> | unknown;
}

export interface RedisSqlCacheOptions {
  /** Optional TTL in seconds for SQL entries. If undefined, no TTL is set. */
  ttlSeconds?: number;
  /** Prefix to namespace keys in shared Redis. */
  keyPrefix?: string;
  /** If true (default), write-through to Redis on set(). */
  writeThrough?: boolean;
}

export class RedisSqlCacheAdapter implements SqlCache {
  private readonly client: RedisClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly writeThrough: boolean;
  private readonly shadow = new Map<string, SqlCacheEntry>();

  constructor(client: RedisClientLike, options?: RedisSqlCacheOptions) {
    this.client = client;
    this.ttlSeconds = options?.ttlSeconds;
    this.keyPrefix = options?.keyPrefix ?? 'tslnq:sql:';
    this.writeThrough = options?.writeThrough ?? true;
  }

  private k(key: string): string {
    return this.keyPrefix + key;
  }

  get(key: string): SqlCacheEntry | undefined {
    return this.shadow.get(key);
  }

  set(key: string, value: SqlCacheEntry): void {
    this.shadow.set(key, { query: value.query, parameters: [...value.parameters] });
    if (!this.writeThrough) return;
    const payload = JSON.stringify({ query: value.query, parameters: value.parameters });
    // Fire-and-forget write-through
    void (async () => {
      try {
        if (this.ttlSeconds && this.ttlSeconds > 0) {
          await this.client.set(this.k(key), payload, 'EX', this.ttlSeconds);
        } else {
          await this.client.set(this.k(key), payload);
        }
      } catch {
        // ignore write errors; shadow still serves
      }
    })();
  }

  clear(): void {
    this.shadow.clear();
  }

  // Not efficient to compute remotely; return -1 to indicate external cache without local size.
  size(): number {
    return this.shadow.size;
  }
}
