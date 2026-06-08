import type { EntityCtor, EntityRef } from '@ts-linq/types';

/** Thrown when a relationship target cannot be resolved to a constructible class. */
export class EntityRefResolutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'EntityRefResolutionError';
  }
}

/** Returns true when `fn` has a non-null prototype object — i.e. it is newable (class or constructor fn). */
function isNewable(fn: unknown): fn is EntityCtor {
  return typeof fn === 'function' && fn.prototype !== undefined && typeof fn.prototype === 'object';
}

/**
 * Resolves a relationship `targetEntity` value to an entity constructor.
 *
 * - Direct constructor → returned with a proper type guard (no cast).
 * - Thunk `() => EntityCtor` → called; result is validated to be constructible.
 *   - Returns `null` only for `ReferenceError` (TDZ during circular-import decoration time).
 *   - Throws `EntityRefResolutionError` for non-constructible results or any other error.
 * - String reference → throws `EntityRefResolutionError` (not supported at runtime).
 */
export function resolveEntityRef(target: string | EntityRef): EntityCtor | null {
  if (typeof target === 'string') {
    throw new EntityRefResolutionError(
      `String entity references are not supported at runtime: "${target}"`
    );
  }

  if (isNewable(target)) {
    return target;
  }

  try {
    const resolved = target();
    if (!isNewable(resolved)) {
      throw new EntityRefResolutionError(
        `Forward-ref thunk returned a non-constructible value: ${String(resolved)}`
      );
    }
    return resolved;
  } catch (e) {
    if (e instanceof ReferenceError) {
      // TDZ: circular import — expected only at decoration time, not at query runtime
      return null;
    }
    if (e instanceof EntityRefResolutionError) throw e;
    throw new EntityRefResolutionError(`Failed to resolve entity forward-ref: ${String(e)}`, e);
  }
}
