import type { EntityCacheLike } from './EntityCache';
/**
 * Simple in-memory FIFO cache for entities keyed by `<EntityName>|<id>`.
 * Intended as a best-effort level-2 cache to reduce allocations and mapping work.
 */
export declare class EntityCache implements EntityCacheLike {
    private _store;
    private _maxSize;
    private _logger?;
    private _providerLabel?;
    /**
     * @param maxSize Maximum number of cached items before FIFO eviction.
     */
    constructor(maxSize?: number, logger?: unknown, providerLabel?: string);
    /** Build a stable cache key from entity constructor and id. */
    private buildKey;
    /** Retrieve a cached entity instance by class and id. */
    get<T>(entityClass: Function, id: unknown): T | undefined;
    /** Store an entity instance with FIFO eviction when size exceeds limit. */
    set<T>(entityClass: Function, id: unknown, entity: T): void;
    /** Remove a cached entity by class and id. */
    remove(entityClass: Function, id: unknown): void;
    /** Clear all cached entities. */
    clear(): void;
    /** Current number of cached items. */
    size(): number;
}
//# sourceMappingURL=EntityCache.d.ts.map