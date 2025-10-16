export interface CachePolicyOptions {
    /** Time-to-live hint in seconds for external caches (adapters may ignore). */
    ttl?: number;
    /** Names of entities whose change should invalidate this entity's caches. */
    invalidateOn?: ReadonlyArray<string>;
}
/**
 * Class decorator to declare cache invalidation dependencies for an entity.
 * Stores metadata under key 'orm:cachePolicy'.
 */
export declare function CachePolicy(options: CachePolicyOptions): ClassDecorator;
//# sourceMappingURL=CachePolicy.d.ts.map