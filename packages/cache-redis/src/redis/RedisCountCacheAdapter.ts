import type { CountCache, CountCacheEntry } from '@ts-linq/core';

export interface RedisClientLike {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<unknown> | unknown;
  del(key: string): Promise<unknown> | unknown;
}

export interface RedisCountCacheOptions {
  ttlSeconds?: number;
  keyPrefix?: string;
}

export class RedisCountCacheAdapter implements CountCache {
  private readonly client: RedisClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly shadow = new Map<string, CountCacheEntry>();

  constructor(client: RedisClientLike, options?: RedisCountCacheOptions) {
    this.client = client;
    this.ttlSeconds = options?.ttlSeconds;
    this.keyPrefix = options?.keyPrefix ?? 'tslnq:cnt:';
  }

  private k(key: string): string {
    return this.keyPrefix + key;
  }

  get(key: string): CountCacheEntry | undefined {
    return this.shadow.get(key);
  }

  set(key: string, entry: CountCacheEntry): void {
    this.shadow.set(key, { value: entry.value, ts: entry.ts });
    const payload = JSON.stringify(entry);
    void (async () => {
      try {
        if (this.ttlSeconds && this.ttlSeconds > 0) {
          await this.client.set(this.k(key), payload, 'EX', this.ttlSeconds);
        } else {
          await this.client.set(this.k(key), payload);
        }
      } catch {
        // ignore
      }
    })();
  }

  clear(): void {
    this.shadow.clear();
  }
}
