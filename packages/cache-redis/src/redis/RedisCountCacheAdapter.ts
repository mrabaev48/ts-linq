interface CountCacheEntry {
  value: number;
  ts: number;
}

export interface CountCache {
  get(key: string): number | undefined;
  set(key: string, value: number): void;
  clear(): void;
}

export interface RedisClientLike {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<unknown> | unknown;
  del(key: string): Promise<unknown> | unknown;
}

export interface RedisSubscriberLike {
  subscribe(channel: string, handler: (message: string) => void): Promise<unknown> | unknown;
}

export interface RedisPublisherLike {
  publish(channel: string, message: string): Promise<unknown> | unknown;
}

export interface RedisCountCacheOptions {
  ttlSeconds?: number;
  keyPrefix?: string;
  shadowMaxSize?: number;
  shadowTtlMs?: number;
  hashKeys?: boolean;
  pubSubChannel?: string;
  subscriber?: RedisSubscriberLike;
  publisher?: RedisPublisherLike;
}

export class RedisCountCacheAdapter implements CountCache {
  private readonly client: RedisClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly shadowMaxSize: number;
  private readonly shadowTtlMs?: number;
  private readonly hashKeys: boolean;
  private readonly pubSubChannel?: string;
  private readonly publisher?: RedisPublisherLike;
  private readonly shadow = new Map<string, { value: CountCacheEntry; ts: number }>();
  private _metrics = { requests: 0, hits: 0, misses: 0, evictions: 0, invalidations: 0 };

  constructor(client: RedisClientLike, options?: RedisCountCacheOptions) {
    this.client = client;
    this.ttlSeconds = options?.ttlSeconds;
    this.keyPrefix = options?.keyPrefix ?? 'tslnq:cnt:';
    this.shadowMaxSize = options?.shadowMaxSize ?? 2000;
    this.shadowTtlMs = options?.shadowTtlMs ?? 0;
    this.hashKeys = options?.hashKeys ?? false;
    this.pubSubChannel = options?.pubSubChannel;
    this.publisher = options?.publisher;
    const sub = options?.subscriber;
    if (this.pubSubChannel && sub) {
      sub.subscribe(this.pubSubChannel, (message: string) => {
        try {
          const msg = JSON.parse(message) as { t: 'del' | 'clear'; k?: string };
          if (msg.t === 'clear') {
            this.shadow.clear();
            return;
          }
          if (msg.t === 'del' && msg.k) this.shadow.delete(msg.k);
        } catch {}
      });
    }
  }

  private k(key: string): string {
    const candidate = this.hashKeys ? this.h(key) : key;
    return this.keyPrefix + candidate;
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

  async getAsync(key: string): Promise<number | undefined> {
    this._metrics.requests++;
    const entry = this.shadow.get(key);
    if (entry) {
      if (this.shadowTtlMs && this.shadowTtlMs > 0 && Date.now() - entry.ts > this.shadowTtlMs) {
        this.shadow.delete(key);
        // Fall through to remote fetch
      } else {
        this._metrics.hits++;
        // LRU touch
        this.shadow.delete(key);
        this.shadow.set(key, { value: entry.value, ts: entry.ts });
        return entry.value.value;
      }
    }

    // Shadow miss (or expired) - try remote
    this._metrics.misses++;
    try {
      const remoteValue = await this.client.get(this.k(key));
      if (!remoteValue) return undefined;

      const parsed = JSON.parse(remoteValue) as CountCacheEntry;
      // Hydrate shadow
      this.ensureCapacity();
      this.shadow.set(key, { value: parsed, ts: Date.now() });
      return parsed.value;
    } catch {
      return undefined;
    }
  }

  set(key: string, value: number): void {
    this.ensureCapacity();
    const entry: CountCacheEntry = { value, ts: Date.now() };
    this.shadow.set(key, { value: entry, ts: Date.now() });
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
    if (this.pubSubChannel && this.publisher)
      void this.publisher.publish(this.pubSubChannel, JSON.stringify({ t: 'clear' }));
    // invalidations add size of previous map; not tracked precisely here
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
        if (this.pubSubChannel && this.publisher)
          void this.publisher.publish(this.pubSubChannel, JSON.stringify({ t: 'del', k }));
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
          await this.client.del(this.k(first));
        } catch {
          /* ignore */
        }
      })();
    }
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

  private h(key: string): string {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) hash = (hash * 33) ^ key.charCodeAt(i);
    return (hash >>> 0).toString(16);
  }
}
