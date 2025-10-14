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
export function CachePolicy(options: CachePolicyOptions): ClassDecorator {
  return (target) => {
    try {
      (
        Reflect as unknown as { defineMetadata?: (k: string, v: unknown, t: Function) => void }
      ).defineMetadata?.('orm:cachePolicy', { ...options }, target as Function);
    } catch {
      // no-op if Reflect metadata not available
    }
  };
}
