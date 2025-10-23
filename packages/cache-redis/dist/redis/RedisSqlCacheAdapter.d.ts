import type { SqlCacheEntry } from '@ts-linq/types';
export interface SqlCache {
    get(key: string): SqlCacheEntry | undefined;
    set(key: string, value: SqlCacheEntry): void;
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
    /** Optional pub/sub channel for invalidation broadcast. */
    pubSubChannel?: string;
    /** Optional subscriber to receive invalidation messages. */
    subscriber?: RedisSubscriberLike;
    /** Optional publisher to send invalidation messages. */
    publisher?: RedisPublisherLike;
}
export declare class RedisSqlCacheAdapter implements SqlCache {
    private readonly client;
    private readonly ttlSeconds?;
    private readonly keyPrefix;
    private readonly writeThrough;
    private readonly shadowMaxSize;
    private readonly shadowTtlMs?;
    private readonly hashKeys;
    private readonly pubSubChannel?;
    private readonly publisher?;
    private readonly shadow;
    constructor(client: RedisClientLike, options?: RedisSqlCacheOptions);
    private k;
    get(key: string): SqlCacheEntry | undefined;
    set(key: string, value: SqlCacheEntry): void;
    clear(): void;
    size(): number;
    invalidateBy(matcher: (key: string) => boolean): number;
    private ensureCapacity;
    private h;
}
//# sourceMappingURL=RedisSqlCacheAdapter.d.ts.map