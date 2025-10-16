import type { SqlParameter } from '../types';
export interface SqlCacheEntry {
    query: string;
    parameters: SqlParameter[];
}
export interface SqlCache {
    get(key: string): SqlCacheEntry | undefined;
    set(key: string, value: SqlCacheEntry): void;
    clear(): void;
    size(): number;
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
/** Simple in-memory FIFO SqlCache with max size. */
export declare class InMemorySqlCache implements SqlCache {
    private maxSize;
    private store;
    constructor(maxSize?: number);
    get(key: string): SqlCacheEntry | undefined;
    set(key: string, value: SqlCacheEntry): void;
    clear(): void;
    size(): number;
    invalidateBy(matcher: (key: string) => boolean): number;
}
//# sourceMappingURL=SqlCache.d.ts.map