export interface CachePolicyOptions {
  /** Time-to-live hint in seconds for external caches (adapters may ignore). */
  ttl?: number;
  /** Names of entities whose change should invalidate this entity's caches. */
  invalidateOn?: ReadonlyArray<string>;
}

// Store cache policies per entity class (Stage-3 compatible)
const cachePolicies = new WeakMap<Function, CachePolicyOptions>();

/**
 * Class decorator to declare cache invalidation dependencies for an entity.
 * Stage-3 compatible - stores metadata in WeakMap.
 */
export function CachePolicy(options: CachePolicyOptions): ClassDecorator {
  return function <TFunction extends Function>(
    target: TFunction,
    context?: unknown
  ): TFunction | void {
    // Stage-3 path
    if (context && typeof context === 'object' && (context as { kind?: unknown }).kind === 'class') {
      cachePolicies.set(target, { ...options });
      (context as { addInitializer?: (fn: (this: unknown) => void) => void }).addInitializer?.(function (this: unknown) {
        const ctor = target as unknown as Function;
        cachePolicies.set(ctor, { ...options });
      });
      return;
    }
    // Fail if not Stage-3
    throw new Error('@CachePolicy requires TS5 Stage-3 decorators');
  };
}

/**
 * Get cache policy for an entity class.
 */
export function getCachePolicy(target: Function): CachePolicyOptions | undefined {
  return cachePolicies.get(target);
}
