import type { EntityCacheLike } from '@ts-linq/types';

import type {
  RedisClientLike,
  RedisPublisherLike,
  RedisSubscriberLike
} from './RedisSqlCacheAdapter';

export interface RedisEntityCacheOptions {
  /** Optional TTL in seconds for Redis entries. If undefined, no TTL is set. */
  ttlSeconds?: number;
  /** Prefix to namespace keys in shared Redis. Default: 'tslnq:entity:' */
  keyPrefix?: string;
  /** If true (default), write-through to Redis on set(). */
  writeThrough?: boolean;
  /** Optional local shadow cache max size (entries). Default: 10000. */
  shadowMaxSize?: number;
  /** Optional local shadow cache TTL in ms. Default: 0 (no TTL). */
  shadowTtlMs?: number;
  /** Hash keys before storing in backend (shadow keeps original). Default: false. */
  hashKeys?: boolean;
  /** Optional pub/sub channel for invalidation broadcast. */
  pubSubChannel?: string;
  /** Optional subscriber to receive invalidation messages. */
  subscriber?: RedisSubscriberLike;
  /** Optional publisher to send invalidation messages. */
  publisher?: RedisPublisherLike;
  /** Custom serializer for entities. Default: JSON.stringify */
  serializer?: (entity: unknown) => string;
  /** Custom deserializer for entities. Default: JSON.parse */
  deserializer?: (data: string) => unknown;
}

export class RedisEntityCacheAdapter implements EntityCacheLike {
  private readonly client: RedisClientLike;
  private readonly ttlSeconds?: number;
  private readonly keyPrefix: string;
  private readonly writeThrough: boolean;
  private readonly shadowMaxSize: number;
  private readonly shadowTtlMs?: number;
  private readonly hashKeys: boolean;
  private readonly pubSubChannel?: string;
  private readonly publisher?: RedisPublisherLike;
  private readonly serializer: (entity: unknown) => string;
  private readonly deserializer: (data: string) => unknown;

  // Shadow cache stores the actual entity instances
  private readonly shadow = new Map<string, { value: unknown; ts: number }>();
  private _metrics = { requests: 0, hits: 0, misses: 0, evictions: 0, invalidations: 0 };

  constructor(client: RedisClientLike, options?: RedisEntityCacheOptions) {
    this.client = client;
    this.ttlSeconds = options?.ttlSeconds;
    this.keyPrefix = options?.keyPrefix ?? 'tslnq:entity:';
    this.writeThrough = options?.writeThrough ?? true;
    this.shadowMaxSize = options?.shadowMaxSize ?? 10000;
    this.shadowTtlMs = options?.shadowTtlMs ?? 0;
    this.hashKeys = options?.hashKeys ?? false;
    this.pubSubChannel = options?.pubSubChannel;
    this.publisher = options?.publisher;
    this.serializer = options?.serializer ?? JSON.stringify;
    this.deserializer = options?.deserializer ?? JSON.parse;

    const sub = options?.subscriber;
    if (this.pubSubChannel && sub) {
      sub.subscribe(this.pubSubChannel, (message: string) => {
        try {
          const parsedMessage = JSON.parse(message) as { type: 'del' | 'clear'; key?: string };
          if (parsedMessage.type === 'clear') {
            this.shadow.clear();
            return;
          }
          if (parsedMessage.type === 'del' && parsedMessage.key) {
            // Note: The message key should be the raw key used in shadow cache
            // However, invalidation usually happens by entity/ID which we reconstruct.
            // If the message contains the exact shadow key, we can delete it.
            this.shadow.delete(parsedMessage.key);
          }
        } catch {
          // Ignore message parse errors
        }
      });
    }
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
      // If not in shadow, we can't return it synchronously.
      // The contract of EntityCacheLike is strictly synchronous.
      // We must rely on 'warmUp' or background loading if we want to support
      // reading from Redis. Since we can't change the interface signature to async,
      // this adapter acts as a write-through, read-from-shadow cache.
      // It DOES NOT support transparent lazy loading from Redis on get().
      // Application code should ensure data is loaded or stick to "best effort" L2 caching behaviour.
      // However, we can try to async fetch it to populate shadow for NEXT time,
      // but that won't help the current call.

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

    // Serialize and write to Redis
    const payload = this.serializer(entity);
    void (async () => {
      try {
        if (this.ttlSeconds && this.ttlSeconds > 0) {
          await this.client.set(this.getNamespacedKey(key), payload, 'EX', this.ttlSeconds);
        } else {
          await this.client.set(this.getNamespacedKey(key), payload);
        }
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
        await this.client.del(this.getNamespacedKey(key));
      } catch {
        // Ignore delete errors
      }
    })();

    if (this.pubSubChannel && this.publisher) {
      void this.publisher.publish(this.pubSubChannel, JSON.stringify({ type: 'del', key: key }));
    }
  }

  public clear(): void {
    this.shadow.clear();
    if (this.pubSubChannel && this.publisher) {
      void this.publisher.publish(this.pubSubChannel, JSON.stringify({ type: 'clear' }));
    }
  }

  public size(): number {
    return this.shadow.size;
  }

  // --- Helper methods ---

  private triggerAsyncFetch(key: string): void {
    void (async () => {
      try {
        const raw = await this.client.get(this.getNamespacedKey(key));
        if (raw) {
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
