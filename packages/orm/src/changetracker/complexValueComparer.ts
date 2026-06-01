/**
 * Deep structural equality and snapshot utilities for complex type properties (P1-17).
 *
 * Complex types use value semantics: two instances are equal if all their
 * leaf values are equal. Unlike entity tracking (identity/reference equality),
 * complex types are compared by structure on every DetectChanges call.
 */

/**
 * Recursively compares two values by structure.
 * Handles: primitives, null/undefined, Date, Array, plain objects.
 */
export function complexDeepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => complexDeepEquals(v, (b as unknown[])[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) =>
      complexDeepEquals((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
    );
  }
  return false;
}

/**
 * Returns a deep clone of a complex value suitable for storing as a snapshot.
 * Uses structuredClone when available, falls back to JSON round-trip.
 */
export function complexSnapshot<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
