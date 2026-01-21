
import type { EntityCacheLike } from '@ts-linq/types';
import type { MemjsClientLike } from './MemcachedSqlCacheAdapter';

export interface MemcachedEntityCacheOptions {
  /** Optional TTL in seconds for entries (default matches server policy or infinite). */
  ttlSeconds?: number;
  /** Prefix to namespace keys in shared Memcached. Default: 'tslnq:entity:' */
  keyPrefix?: string;
  /** If true (default), write-through to Memcached on set(). */
  writeThrough?: boolean;
  /** Optional local shadow cache max size (entries). Default: 10000. */
  shadowMaxSize?: number;
  /** Optional local shadow cache TTL in ms. Default: 0 (no TTL). */
  shadowTtlMs?: number;
  /** Hash keys before storing in backend (shadow keeps original). Default: false. */
  hashKeys?: boolean;
  /** Custom serializer for entities. Default: JSON.stringify */
  serializer?: (entity: unknown) => string;
  /** Custom deserializer for entities. Default: JSON.parse */
  deserializer?: (data: string) => unknown;
}

export class MemcachedEntityCacheAdapter implements EntityCacheLike {
  private readonly client: MemjsClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly writeThrough: boolean;
  private readonly shadowMaxSize: number;
  private readonly shadowTtlMs?: number;
  private readonly hashKeys: boolean;
  private readonly serializer: (entity: unknown) => string;
  private readonly deserializer: (data: string) => unknown;

  // Shadow cache stores the actual entity instances
  private readonly shadow = new Map<string, { value: unknown; ts: number }>();
  private _metrics = { requests: 0, hits: 0, misses: 0, evictions: 0, invalidations: 0 };

  constructor(client: MemjsClientLike, options?: MemcachedEntityCacheOptions) {
    this.client = client;
    this.ttlSeconds = options?.ttlSeconds;
    this.keyPrefix = options?.keyPrefix ?? 'tslnq:entity:';
    this.writeThrough = options?.writeThrough ?? true;
    this.shadowMaxSize = options?.shadowMaxSize ?? 10000;
    this.shadowTtlMs = options?.shadowTtlMs ?? 0;
    this.hashKeys = options?.hashKeys ?? false;
    this.serializer = options?.serializer ?? JSON.stringify;
    this.deserializer = options?.deserializer ?? JSON.parse;
  }

  private buildKey(entityClass: Function, id: unknown): string {
    return `${entityClass.name}|${String(id)}`;
  }

  private getNamespacedKey(key: string): string {
    const candidate = this.hashKeys ? this.computeHash(key) : key;
    return this.keyPrefix + candidate;
  }

  public get<T>(entityClass: Function, id: unknown): T | undefined {
    if (id === undefined || id === null) return undefined;
    const key = this.buildKey(entityClass, id);

    // Check shadow first (sync)
    const entry = this.shadow.get(key);
    if (!entry) {
      // Async fetch to maybe populate shadow next time
      this.triggerAsyncFetch(key);
      return undefined;
    }

    if (this.shadowTtlMs && this.shadowTtlMs > 0 && Date.now() - entry.ts > this.shadowTtlMs) {
      this.shadow.delete(key);
      this.triggerAsyncFetch(key);
      return undefined;
    }

    // LRU: move to end
    this.shadow.delete(key);
    this.shadow.set(key, { value: entry.value, ts: entry.ts });
    return entry.value as T;
  }

  public set<T>(entityClass: Function, id: unknown, entity: T): void {
    if (id === undefined || id === null) return;
    const key = this.buildKey(entityClass, id);

    this.ensureCapacity();
    this.shadow.set(key, { value: entity, ts: Date.now() });

    if (!this.writeThrough) return;

    // Serialize and write to Memcached
    const payload = this.serializer(entity);
    const options = this.ttlSeconds && this.ttlSeconds > 0 ? { expires: this.ttlSeconds } : undefined;

    void (async () => {
      try {
        await this.client.set(this.getNamespacedKey(key), payload, options);
      } catch {
        // Ignore write-through errors
      }
    })();
  }

  public remove(entityClass: Function, id: unknown): void {
    if (id === undefined || id === null) return;
    const key = this.buildKey(entityClass, id);

    this.shadow.delete(key);

    void (async () => {
      try {
        await this.client.delete(this.getNamespacedKey(key));
      } catch {
        // Ignore delete errors
      }
    })();
  }

  public clear(): void {
    this.shadow.clear();
    // Memcached doesn't support easy "clear by prefix" without flush_all which is dangerous
    // So we only clear the local shadow.
    // If strict consistency is needed, one would use shorter TTLs.
  }

  public size(): number {
    return this.shadow.size;
  }

  // --- Helper methods ---

  private triggerAsyncFetch(key: string): void {
    void (async () => {
      try {
        const result = await this.client.get(this.getNamespacedKey(key));
        if (result && result.value) {
           const raw = result.value.toString('utf8');
           const entity = this.deserializer(raw);
           this.ensureCapacity();
           this.shadow.set(key, { value: entity, ts: Date.now() });
        }
      } catch {
        // ignore
      }
    })();
  }

  private ensureCapacity(): void {
    while (this.shadow.size >= this.shadowMaxSize) {
      const first = this.shadow.keys().next().value;
      if (first === undefined) break;
      this.shadow.delete(first);
      this._metrics.evictions++;
    }
  }

  private computeHash(key: string): string {
    // Lightweight non-crypto hash (djb2)
    let hash = 5381;
    for (let i = 0; i < key.length; i++) hash = (hash * 33) ^ key.charCodeAt(i);
    return (hash >>> 0).toString(16);
  }
}
