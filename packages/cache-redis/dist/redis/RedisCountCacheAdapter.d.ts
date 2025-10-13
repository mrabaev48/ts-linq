import type { CountCache, CountCacheEntry } from '@ts-linq/core';
export interface RedisClientLike {
    get(key: string): Promise<string | null> | string | null;
    set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<unknown> | unknown;
    del(key: string): Promise<unknown> | unknown;
}
export interface RedisCountCacheOptions {
    ttlSeconds?: number;
    keyPrefix?: string;
}
export declare class RedisCountCacheAdapter implements CountCache {
    private readonly client;
    private readonly ttlSeconds?;
    private readonly keyPrefix;
    private readonly shadow;
    constructor(client: RedisClientLike, options?: RedisCountCacheOptions);
    private k;
    get(key: string): CountCacheEntry | undefined;
    set(key: string, entry: CountCacheEntry): void;
    clear(): void;
}
//# sourceMappingURL=RedisCountCacheAdapter.d.ts.map