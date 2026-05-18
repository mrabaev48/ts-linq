import type { RelationshipMetadata } from '@ts-linq/types';

/**
 * Resolves a `RelationshipMetadata.targetEntity` to a concrete constructor.
 * Returns `null` when the target is a string reference or when the factory throws.
 */
export function resolveTargetCtor(
  target: RelationshipMetadata['targetEntity']
): (new () => unknown) | null {
  if (typeof target === 'string') return null;
  if (typeof target === 'function') {
    if ('prototype' in target && (target as { prototype?: unknown }).prototype) {
      return target as new () => unknown;
    }
    try {
      const resolved = (target as () => Function)();
      return resolved as new () => unknown;
    } catch {
      return null;
    }
  }
  return null;
}
