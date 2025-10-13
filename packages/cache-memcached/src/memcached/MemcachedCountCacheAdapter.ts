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
}

export class MemcachedCountCacheAdapter implements CountCache {
  private readonly client: MemjsClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly shadow = new Map<string, CountCacheEntry>();

  constructor(client: MemjsClientLike, options?: MemcachedCountCacheOptions) {
    this.client = client;
    this.ttlSeconds = options?.ttlSeconds;
    this.keyPrefix = options?.keyPrefix ?? 'tslnq:cnt:';
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
    return this.shadow.get(key);
  }

  set(key: string, entry: CountCacheEntry): void {
    this.shadow.set(key, { value: entry.value, ts: entry.ts });
    const payload = JSON.stringify(entry);
    const options =
      this.ttlSeconds && this.ttlSeconds > 0 ? { expires: this.ttlSeconds } : undefined;
    void this.client.set(this.k(key), payload, options);
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
          } catch {
            /* ignore */
          }
        })();
      }
    }
    return removed;
  }
}
