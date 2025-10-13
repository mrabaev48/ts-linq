import type { CountCache, CountCacheEntry } from '@ts-linq/core';
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
export interface MemcachedCountCacheOptions {
    ttlSeconds?: number;
    keyPrefix?: string;
}
export declare class MemcachedCountCacheAdapter implements CountCache {
    private readonly client;
    private readonly ttlSeconds?;
    private readonly keyPrefix;
    private readonly shadow;
    constructor(client: MemjsClientLike, options?: MemcachedCountCacheOptions);
    private k;
    private decode;
    get(key: string): CountCacheEntry | undefined;
    set(key: string, entry: CountCacheEntry): void;
    clear(): void;
}
//# sourceMappingURL=MemcachedCountCacheAdapter.d.ts.map