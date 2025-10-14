import type { SqlCache, SqlCacheEntry } from '@ts-linq/core';
export interface RedisClientLike {
    get(key: string): Promise<string | null> | string | null;
    set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<unknown> | unknown;
    del(key: string): Promise<unknown> | unknown;
}
export interface RedisSqlCacheOptions {
    /** Optional TTL in seconds for SQL entries. If undefined, no TTL is set. */
    ttlSeconds?: number;
    /** Prefix to namespace keys in shared Redis. */
    keyPrefix?: string;
    /** If true (default), write-through to Redis on set(). */
    writeThrough?: boolean;
}
export declare class RedisSqlCacheAdapter implements SqlCache {
    private readonly client;
    private readonly ttlSeconds?;
    private readonly keyPrefix;
    private readonly writeThrough;
    private readonly shadow;
    constructor(client: RedisClientLike, options?: RedisSqlCacheOptions);
    private k;
    get(key: string): SqlCacheEntry | undefined;
    set(key: string, value: SqlCacheEntry): void;
    clear(): void;
    size(): number;
}
//# sourceMappingURL=RedisSqlCacheAdapter.d.ts.map