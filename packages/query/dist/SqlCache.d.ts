import type { SqlCache, SqlCacheEntry } from '@ts-linq/types';
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