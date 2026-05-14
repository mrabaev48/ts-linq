# ISSUE-014: Deprecated No-Op Method in Public API

## Severity

Low

## Category

- Public API
- Clean Code
- Maintainability

## Location

- `packages/query/src/Queryable.ts:134`

## Problem

`Queryable.clearCountCache()` is a static public method kept in the public API as a no-op for "backward compatibility":

```typescript
/**
 * @deprecated Count cache is now owned per-context via `PerformanceOptions.countCache`.
 * This method is a no-op kept for backward compatibility.
 */
public static clearCountCache(): void {
  // no-op: count cache is now owned by the DbContext (per-context InMemoryCountCache).
}
```

This is a public API surface point that:
- Does nothing when called
- Cannot be removed without a breaking change
- Misleads consumers who may believe they are managing a global cache
- Silently fails to produce the behavior its name implies

The method documents that count cache is "now owned per-context" — but the per-context API (`PerformanceOptions.countCache`) is not exposed in a way that allows the same clearing operation. Consumers migrating from the old global cache to the per-context cache have no replacement API.

## Evidence

```typescript
// packages/query/src/Queryable.ts:130–137
/**
 * @deprecated Count cache is now owned per-context via `PerformanceOptions.countCache`.
 * This method is a no-op kept for backward compatibility.
 */
public static clearCountCache(): void {
  // no-op: count cache is now owned by the DbContext (per-context InMemoryCountCache).
}
```

The JSDoc references a static class method on what is a non-static, per-context concern. The deprecation notice provides no migration path.

## Why It Matters

- **API clarity**: Public APIs communicate intent. A no-op method that silently does nothing is actively misleading.
- **Maintainability**: Any future cache redesign must continue carrying this dead method or risk a breaking change.
- **Consumer trust**: A consumer who calls `clearCountCache()` expecting cache invalidation will see stale count results with no error or warning.

## Recommended Fix

1. **Short-term**: Update the `@deprecated` JSDoc to explicitly state "this method does nothing — remove all calls to it". Add a `console.warn` in development mode (when `process.env.NODE_ENV !== 'production'`) to alert consumers who still call it.

2. **Long-term**: Target removal in the next major version. Add the removal to the CHANGELOG and MIGRATION.md. Expose a per-context `clearCountCache()` method on `DbContext` if consumers genuinely need to invalidate count caches programmatically.

```typescript
// On DbContext:
public clearCountCache(): void {
  this._countCache?.clear();
}
```

## Acceptance Criteria

- `Queryable.clearCountCache()` is either removed (in a major version) or emits a `console.warn` when called
- If removed, `DbContext` exposes a replacement `clearCountCache()` instance method
- Deprecation notice in JSDoc includes explicit migration guidance: "Remove all calls — this method is a no-op. Use `dbContext.cache.clear()` to manage per-context caches."
- The method is targeted for removal in the next major version, tracked in CHANGELOG or roadmap
