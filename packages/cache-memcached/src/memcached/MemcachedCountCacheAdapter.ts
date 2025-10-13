import type { CountCache, CountCacheEntry } from '@ts-linq/core';

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
}

export class MemcachedCountCacheAdapter implements CountCache {
  private readonly client: MemjsClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly shadowMaxSize: number;
  private readonly shadowTtlMs?: number;
  private readonly shadow = new Map<string, { value: CountCacheEntry; ts: number }>();

  constructor(client: MemjsClientLike, options?: MemcachedCountCacheOptions) {
    this.client = client;
    this.ttlSeconds = options?.ttlSeconds;
    this.keyPrefix = options?.keyPrefix ?? 'tslnq:cnt:';
    this.shadowMaxSize = options?.shadowMaxSize ?? 2000;
    this.shadowTtlMs = options?.shadowTtlMs ?? 0;
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
            await this.client.delete(this.k(k));
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[MemcachedCountCacheAdapter] delete failed', { key: this.k(k) });
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
          await this.client.delete(this.k(first));
        } catch {
          /* ignore */
        }
      })();
    }
  }
}
