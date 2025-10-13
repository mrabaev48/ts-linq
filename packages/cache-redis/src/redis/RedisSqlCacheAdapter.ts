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
  /** Optional local shadow cache max size (entries). Default: 2000. */
  shadowMaxSize?: number;
  /** Optional local shadow cache TTL in ms. Default: 0 (no TTL). */
  shadowTtlMs?: number;
  /** Hash keys before storing in backend (shadow keeps original). Default: false. */
  hashKeys?: boolean;
}

export class RedisSqlCacheAdapter implements SqlCache {
  private readonly client: RedisClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly writeThrough: boolean;
  private readonly shadowMaxSize: number;
  private readonly shadowTtlMs?: number;
  private readonly hashKeys: boolean;
  private readonly shadow = new Map<string, { value: SqlCacheEntry; ts: number }>();

  constructor(client: RedisClientLike, options?: RedisSqlCacheOptions) {
    this.client = client;
    this.ttlSeconds = options?.ttlSeconds;
    this.keyPrefix = options?.keyPrefix ?? 'tslnq:sql:';
    this.writeThrough = options?.writeThrough ?? true;
    this.shadowMaxSize = options?.shadowMaxSize ?? 2000;
    this.shadowTtlMs = options?.shadowTtlMs ?? 0;
    this.hashKeys = options?.hashKeys ?? false;
  }

  private k(key: string): string {
    const candidate = this.hashKeys ? this.h(key) : key;
    return this.keyPrefix + candidate;
  }

  get(key: string): SqlCacheEntry | undefined {
    const entry = this.shadow.get(key);
    if (!entry) return undefined;
    if (this.shadowTtlMs && this.shadowTtlMs > 0 && Date.now() - entry.ts > this.shadowTtlMs) {
      this.shadow.delete(key);
      return undefined;
    }
    return { query: entry.value.query, parameters: [...entry.value.parameters] };
  }

  set(key: string, value: SqlCacheEntry): void {
    this.ensureCapacity();
    this.shadow.set(key, {
      value: { query: value.query, parameters: [...value.parameters] },
      ts: Date.now()
    });
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
      } catch (e) {
        // best-effort logging to not fail prod path
        // eslint-disable-next-line no-console
        console.warn('[RedisSqlCacheAdapter] write-through failed', { key: this.k(key) });
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
            console.warn('[RedisSqlCacheAdapter] delete failed', { key: this.k(k) });
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
      // best-effort remote clean
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
    // Lightweight non-crypto hash (djb2) to keep bundle small
    let hash = 5381;
    for (let i = 0; i < key.length; i++) hash = (hash * 33) ^ key.charCodeAt(i);
    // Convert to unsigned 32-bit and hex
    return (hash >>> 0).toString(16);
  }
}
