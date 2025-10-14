import type { SqlCache, SqlCacheEntry } from '@ts-linq/core';
export interface MemjsClientLike {
    get(key: string): Promise<{
        value: Buffer | null;
    } | null> | {
        value: Buffer | null;
    } | null;
    set(key: string, value: Buffer | string, options?: {
        expires?: number;
    }): Promise<unknown> | unknown;
    delete(key: string): Promise<unknown> | unknown;
}
export interface MemcachedSqlCacheOptions {
    ttlSeconds?: number;
    keyPrefix?: string;
}
export declare class MemcachedSqlCacheAdapter implements SqlCache {
    private readonly client;
    private readonly ttlSeconds?;
    private readonly keyPrefix;
    private readonly shadow;
    constructor(client: MemjsClientLike, options?: MemcachedSqlCacheOptions);
    private k;
    private decode;
    get(key: string): SqlCacheEntry | undefined;
    set(key: string, value: SqlCacheEntry): void;
    clear(): void;
    size(): number;
}
//# sourceMappingURL=MemcachedSqlCacheAdapter.d.ts.map