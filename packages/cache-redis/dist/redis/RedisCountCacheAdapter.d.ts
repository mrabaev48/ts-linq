import type { CountCache, CountCacheEntry } from '@ts-linq/core';
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
export declare class RedisCountCacheAdapter implements CountCache {
    private readonly client;
    private readonly ttlSeconds?;
    private readonly keyPrefix;
    private readonly shadowMaxSize;
    private readonly shadowTtlMs?;
    private readonly hashKeys;
    private readonly pubSubChannel?;
    private readonly publisher?;
    private readonly shadow;
    private _metrics;
    constructor(client: RedisClientLike, options?: RedisCountCacheOptions);
    private k;
    get(key: string): CountCacheEntry | undefined;
    set(key: string, entry: CountCacheEntry): void;
    clear(): void;
    invalidateBy(matcher: (key: string) => boolean): number;
    private ensureCapacity;
    getMetrics(): {
        currentSize: number;
        totalRequests: number;
        hits: number;
        misses: number;
        evictions: number;
        invalidations: number;
    };
    private h;
}
//# sourceMappingURL=RedisCountCacheAdapter.d.ts.map