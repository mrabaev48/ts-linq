export interface CachePolicyOptions {
    /** Time-to-live hint in seconds for external caches (adapters may ignore). */
    ttl?: number;
    /** Names of entities whose change should invalidate this entity's caches. */
    invalidateOn?: ReadonlyArray<string>;
}
/**
 * Class decorator to declare cache invalidation dependencies for an entity.
 * Uses legacy TypeScript decorators (experimentalDecorators: true).
 */
export declare function CachePolicy(options: CachePolicyOptions): ClassDecorator;
/**
 * Get cache policy for an entity class.
 */
export declare function getCachePolicy(target: Function): CachePolicyOptions | undefined;
//# sourceMappingURL=CachePolicy.d.ts.map