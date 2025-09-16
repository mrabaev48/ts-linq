export interface CountCacheEntry {
    value: number;
    ts: number;
}
export interface CountCache {
    get(key: string): CountCacheEntry | undefined;
    set(key: string, entry: CountCacheEntry): void;
    clear(): void;
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
}
//# sourceMappingURL=CountCache.d.ts.map