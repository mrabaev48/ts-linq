interface CountCacheEntry {
  value: number;
  ts: number;
}

export interface CountCache {
  get(key: string): number | undefined;
  set(key: string, value: number): void;
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

export interface MemcachedCountCacheOptions {
  ttlSeconds?: number;
  keyPrefix?: string;
  shadowMaxSize?: number;
  shadowTtlMs?: number;
  hashKeys?: boolean;
}

export class MemcachedCountCacheAdapter implements CountCache {
  private readonly client: MemjsClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly shadowMaxSize: number;
  private readonly shadowTtlMs?: number;
  private readonly hashKeys: boolean;
  private readonly shadow = new Map<string, { value: CountCacheEntry; ts: number }>();
  private _metrics = { requests: 0, hits: 0, misses: 0, evictions: 0, invalidations: 0 };

  constructor(client: MemjsClientLike, options?: MemcachedCountCacheOptions) {
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

  private decode(b: Buffer | null): string | null {
    if (!b) return null;
    try {
      return b.toString('utf8');
    } catch {
      return null;
    }
  }

  get(key: string): number | undefined {
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
    return entry.value.value;
  }

  set(key: string, value: number): void {
    this.ensureCapacity();
    const entry: CountCacheEntry = { value, ts: Date.now() };
    this.shadow.set(key, { value: entry, ts: Date.now() });
    const payload = JSON.stringify(entry);
    const options =
      this.ttlSeconds && this.ttlSeconds > 0 ? { expires: this.ttlSeconds } : undefined;
    void (async () => {
      try {
        await this.client.set(this.k(key), payload, options);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[MemcachedCountCacheAdapter] write-through failed', { key: this.k(key) });
      }
    })();
  }

  clear(): void {
    const removed = this.shadow.size;
    this.shadow.clear();
    this._metrics.invalidations += removed;
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
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[MemcachedCountCacheAdapter] delete failed', { key: this.k(k) });
          }
        })();
        this._metrics.invalidations++;
      }
    }
    return removed;
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

  public getMetrics() {
    return {
      currentSize: this.shadow.size,
      totalRequests: this._metrics.requests,
      hits: this._metrics.hits,
      misses: this._metrics.misses,
      evictions: this._metrics.evictions,
      invalidations: this._metrics.invalidations
    };
  }
}
