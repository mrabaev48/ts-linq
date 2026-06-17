/**
 * Single equality definition shared by all change-detection paths (P1 refactor task-4).
 *
 * Before this strategy existed, three near-identical deep-equal mechanisms were
 * scattered across `ChangeTracker` (`areObjectsEqual`) and `complexValueComparer`
 * (`complexDeepEquals`). They are consolidated here so a bug in one path (e.g.
 * key-order sensitivity) is fixed in exactly one place.
 *
 * Semantics (preserved from both originals):
 *  - Reference identity short-circuit.
 *  - `null`/`undefined` compared by strict equality.
 *  - `Date` compared by `.getTime()` (value, not reference).
 *  - Arrays compared element-by-element (length first).
 *  - Plain objects compared by sorted key-set (key-order insensitive) then values.
 */
export interface EqualityComparer {
  /** Returns true when `a` and `b` are structurally equal. */
  equals(a: unknown, b: unknown): boolean;
}

/**
 * Default recursive structural comparer. Stateless — safe to share as a singleton.
 */
export class DeepEqualityComparer implements EqualityComparer {
  equals(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    // null / undefined only equal to themselves (handled by the identity check above).
    if (a === null || a === undefined || b === null || b === undefined) return a === b;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => this.equals(v, (b as unknown[])[i]));
    }
    if (typeof a === 'object' && typeof b === 'object') {
      // Sorted keys eliminate key-order sensitivity (e.g. JSON.stringify ordering surprises).
      const ka = Object.keys(a as object).sort();
      const kb = Object.keys(b as object).sort();
      if (ka.length !== kb.length) return false;
      if (ka.join('\x00') !== kb.join('\x00')) return false;
      return ka.every((k) =>
        this.equals((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
      );
    }
    return false;
  }
}

/** Shared default instance — the comparer is stateless, so one instance suffices. */
export const defaultEqualityComparer: EqualityComparer = new DeepEqualityComparer();
