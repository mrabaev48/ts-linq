/**
 * Deep structural equality and snapshot utilities for complex type properties (P1-17).
 *
 * Complex types use value semantics: two instances are equal if all their
 * leaf values are equal. Unlike entity tracking (identity/reference equality),
 * complex types are compared by structure on every DetectChanges call.
 */

import { defaultEqualityComparer } from './EqualityComparer';

/**
 * Recursively compares two values by structure.
 * Handles: primitives, null/undefined, Date, Array, plain objects.
 *
 * @remarks
 * Thin delegate to the shared {@link defaultEqualityComparer} so there is exactly
 * one deep-equality implementation in the package (refactor task-4). Retained as a
 * named export for backward compatibility and complex-type call sites.
 */
export function complexDeepEquals(a: unknown, b: unknown): boolean {
  return defaultEqualityComparer.equals(a, b);
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
