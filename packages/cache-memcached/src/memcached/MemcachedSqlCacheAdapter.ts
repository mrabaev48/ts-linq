import type { SqlCacheEntry } from '@ts-linq/core';

export interface SqlCache {
  get(key: string): SqlCacheEntry | undefined;
  set(key: string, value: SqlCacheEntry): void;
  clear(): void;
}

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
  shadowMaxSize?: number;
  shadowTtlMs?: number;
  hashKeys?: boolean;
}

export class MemcachedSqlCacheAdapter implements SqlCache {
  private readonly client: MemjsClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly shadowMaxSize: number;
  private readonly shadowTtlMs?: number;
  private readonly hashKeys: boolean;
  private readonly shadow = new Map<string, { value: SqlCacheEntry; ts: number }>();
  private _metrics = { requests: 0, hits: 0, misses: 0, evictions: 0, invalidations: 0 };

  constructor(client: MemjsClientLike, options?: MemcachedSqlCacheOptions) {
    this.client = client;
    this.ttlSeconds = options?.ttlSeconds;
    this.keyPrefix = options?.keyPrefix ?? 'tslnq:sql:';
    this.shadowMaxSize = options?.shadowMaxSize ?? 2000;
    this.shadowTtlMs = options?.shadowTtlMs ?? 0;
    this.hashKeys = options?.hashKeys ?? false;
  }

  private k(key: string): string {
    const candidate = this.hashKeys ? this.h(key) : key;
    return this.keyPrefix + candidate;
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
    this._metrics.requests++;
    const entry = this.shadow.get(key);
    if (!entry) return undefined;
    if (this.shadowTtlMs && this.shadowTtlMs > 0 && Date.now() - entry.ts > this.shadowTtlMs) {
      this.shadow.delete(key);
      this._metrics.misses++;
      return undefined;
    }
    this._metrics.hits++;
    // LRU touch
    this.shadow.delete(key);
    this.shadow.set(key, { value: entry.value, ts: entry.ts });
    return { query: entry.value.query, parameters: [...entry.value.parameters] };
  }

  set(key: string, value: SqlCacheEntry): void {
    this.ensureCapacity();
    this.shadow.set(key, {
      value: { query: value.query, parameters: [...value.parameters] },
      ts: Date.now()
    });
    const payload = JSON.stringify({ query: value.query, parameters: value.parameters });
    const options =
      this.ttlSeconds && this.ttlSeconds > 0 ? { expires: this.ttlSeconds } : undefined;
    void (async () => {
      try {
        await this.client.set(this.k(key), payload, options);
      } catch {
        // Ignore write-through errors
      }
    })();
  }

  clear(): void {
    const removed = this.shadow.size;
    this.shadow.clear();
    this._metrics.invalidations += removed;
  }

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
            await this.client.delete(this.k(k));
          } catch {
            // Ignore delete errors
          }
        })();
        this._metrics.invalidations++;
      }
    }
    return removed;
  }

  public getMetrics(): {
    currentSize: number;
    totalRequests?: number;
    hits?: number;
    misses?: number;
    evictions?: number;
    invalidations?: number;
  } {
    return {
      currentSize: this.shadow.size,
      totalRequests: this._metrics.requests,
      hits: this._metrics.hits,
      misses: this._metrics.misses,
      evictions: this._metrics.evictions,
      invalidations: this._metrics.invalidations
    };
  }

  private ensureCapacity(): void {
    while (this.shadow.size >= this.shadowMaxSize) {
      const first = this.shadow.keys().next().value;
      if (first === undefined) break;
      this.shadow.delete(first);
      this._metrics.evictions++;
      void (async () => {
        try {
          await this.client.delete(this.k(first));
        } catch {
          // Ignore delete errors
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
