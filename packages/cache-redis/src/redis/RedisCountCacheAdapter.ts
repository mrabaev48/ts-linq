import type { CountCache, CountCacheEntry } from '@ts-linq/core';

export interface RedisClientLike {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<unknown> | unknown;
  del(key: string): Promise<unknown> | unknown;
}

export interface RedisCountCacheOptions {
  ttlSeconds?: number;
  keyPrefix?: string;
  shadowMaxSize?: number;
  shadowTtlMs?: number;
  hashKeys?: boolean;
}

export class RedisCountCacheAdapter implements CountCache {
  private readonly client: RedisClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly shadowMaxSize: number;
  private readonly shadowTtlMs?: number;
  private readonly hashKeys: boolean;
  private readonly shadow = new Map<string, { value: CountCacheEntry; ts: number }>();

  constructor(client: RedisClientLike, options?: RedisCountCacheOptions) {
    this.client = client;
    this.ttlSeconds = options?.ttlSeconds;
    this.keyPrefix = options?.keyPrefix ?? 'tslnq:cnt:';
    this.shadowMaxSize = options?.shadowMaxSize ?? 2000;
    this.shadowTtlMs = options?.shadowTtlMs ?? 0;
    this.hashKeys = options?.hashKeys ?? false;
  }

  private k(key: string): string {
    const candidate = this.hashKeys ? this.h(key) : key;
    return this.keyPrefix + candidate;
  }

  get(key: string): CountCacheEntry | undefined {
    const entry = this.shadow.get(key);
    if (!entry) return undefined;
    if (this.shadowTtlMs && this.shadowTtlMs > 0 && Date.now() - entry.ts > this.shadowTtlMs) {
      this.shadow.delete(key);
      return undefined;
    }
    return { value: entry.value.value, ts: entry.value.ts };
  }

  set(key: string, entry: CountCacheEntry): void {
    this.ensureCapacity();
    this.shadow.set(key, { value: { value: entry.value, ts: entry.ts }, ts: Date.now() });
    const payload = JSON.stringify(entry);
    void (async () => {
      try {
        if (this.ttlSeconds && this.ttlSeconds > 0) {
          await this.client.set(this.k(key), payload, 'EX', this.ttlSeconds);
        } else {
          await this.client.set(this.k(key), payload);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[RedisCountCacheAdapter] write-through failed', { key: this.k(key) });
      }
    })();
  }

  clear(): void {
    this.shadow.clear();
  }

  invalidateBy(matcher: (key: string) => boolean): number {
    let removed = 0;
    for (const k of Array.from(this.shadow.keys())) {
      if (matcher(k)) {
        this.shadow.delete(k);
        removed++;
        void (async () => {
          try {
            await this.client.del(this.k(k));
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[RedisCountCacheAdapter] delete failed', { key: this.k(k) });
          }
        })();
      }
    }
    return removed;
  }

  private ensureCapacity(): void {
    while (this.shadow.size >= this.shadowMaxSize) {
      const first = this.shadow.keys().next().value;
      if (first === undefined) break;
      this.shadow.delete(first);
      void (async () => {
        try {
          await this.client.del(this.k(first));
        } catch {
          /* ignore */
        }
      })();
    }
  }

  private h(key: string): string {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) hash = (hash * 33) ^ key.charCodeAt(i);
    return (hash >>> 0).toString(16);
  }
}
