import type { SqlCacheEntry } from '@ts-linq/types';
export interface SqlCache {
    get(key: string): SqlCacheEntry | undefined;
    set(key: string, value: SqlCacheEntry): void;
    clear(): void;
}
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
    shadowMaxSize?: number;
    shadowTtlMs?: number;
    hashKeys?: boolean;
}
export declare class MemcachedSqlCacheAdapter implements SqlCache {
    private readonly client;
    private readonly ttlSeconds?;
    private readonly keyPrefix;
    private readonly shadowMaxSize;
    private readonly shadowTtlMs?;
    private readonly hashKeys;
    private readonly shadow;
    private _metrics;
    constructor(client: MemjsClientLike, options?: MemcachedSqlCacheOptions);
    private k;
    private decode;
    get(key: string): SqlCacheEntry | undefined;
    set(key: string, value: SqlCacheEntry): void;
    clear(): void;
    size(): number;
    invalidateBy(matcher: (key: string) => boolean): number;
    getMetrics(): {
        currentSize: number;
        totalRequests?: number;
        hits?: number;
        misses?: number;
        evictions?: number;
        invalidations?: number;
    };
    private ensureCapacity;
    private h;
}
//# sourceMappingURL=MemcachedSqlCacheAdapter.d.ts.map