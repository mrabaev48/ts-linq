import type { EntityCtor } from '@ts-linq/types';

export interface CachePolicyOptions {
  /** Time-to-live hint in seconds for external caches (adapters may ignore). */
  ttl?: number;
  /** Names of entities whose change should invalidate this entity's caches. */
  invalidateOn?: ReadonlyArray<string>;
}

// Store cache policies per entity class
const cachePolicies = new WeakMap<EntityCtor, CachePolicyOptions>();

/**
 * Class decorator to declare cache invalidation dependencies for an entity.
 * Uses legacy TypeScript decorators (experimentalDecorators: true).
 */
export function CachePolicy(options: CachePolicyOptions) {
  return function <T extends EntityCtor>(target: T): T | void {
    cachePolicies.set(target, { ...options });
    return target;
  };
}

/**
 * Get cache policy for an entity class.
 */
export function getCachePolicy(target: EntityCtor): CachePolicyOptions | undefined {
  return cachePolicies.get(target);
}
