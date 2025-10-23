export interface CountCache {
    get(key: string): number | undefined;
    set(key: string, value: number): void;
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
export interface MemcachedCountCacheOptions {
    ttlSeconds?: number;
    keyPrefix?: string;
    shadowMaxSize?: number;
    shadowTtlMs?: number;
    hashKeys?: boolean;
}
export declare class MemcachedCountCacheAdapter implements CountCache {
    private readonly client;
    private readonly ttlSeconds?;
    private readonly keyPrefix;
    private readonly shadowMaxSize;
    private readonly shadowTtlMs?;
    private readonly hashKeys;
    private readonly shadow;
    private _metrics;
    constructor(client: MemjsClientLike, options?: MemcachedCountCacheOptions);
    private k;
    private decode;
    get(key: string): number | undefined;
    set(key: string, value: number): void;
    clear(): void;
    invalidateBy(matcher: (key: string) => boolean): number;
    private ensureCapacity;
    private h;
    getMetrics(): {
        currentSize: number;
        totalRequests: number;
        hits: number;
        misses: number;
        evictions: number;
        invalidations: number;
    };
}
//# sourceMappingURL=MemcachedCountCacheAdapter.d.ts.map