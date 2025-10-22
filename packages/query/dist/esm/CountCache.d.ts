export interface CountCacheEntry {
    value: number;
    ts: number;
}
export interface CountCache {
    get(key: string): CountCacheEntry | undefined;
    set(key: string, entry: CountCacheEntry): void;
    clear(): void;
    /** Optional targeted invalidation. Should return number of removed entries. */
    invalidateBy?(matcher: (key: string) => boolean): number;
    /** Optional metrics exposure for monitoring. */
    getMetrics?(): {
        currentSize: number;
        totalRequests?: number;
        hits?: number;
        misses?: number;
        evictions?: number;
        invalidations?: number;
    };
}
/** In-memory CountCache with TTL and max size (FIFO eviction). */
export declare class InMemoryCountCache implements CountCache {
    private ttlMs;
    private maxSize;
    private store;
    constructor(ttlMs?: number, maxSize?: number);
    get(key: string): CountCacheEntry | undefined;
    set(key: string, entry: CountCacheEntry): void;
    clear(): void;
    invalidateBy(matcher: (key: string) => boolean): number;
}
//# sourceMappingURL=CountCache.d.ts.map