# ISSUE-004: `TypedQueryable` Accesses Private `Queryable` Internals via Unsafe Casts

## Severity

High

## Category

- Type System
- SOLID
- Maintainability

## Location

- `packages/query/src/TypedQueryable.ts` — lines 70, 190, 208, 221 (and surrounding)

## Problem

`TypedQueryable<TEntity>` is designed as a type-safe wrapper around `Queryable<T>`. However, it cannot call the wrapped class's own public methods without breaking the type system via `as unknown as { ... }` casts.

This reveals a structural problem: `TypedQueryable` is not a proper abstraction over `Queryable`'s interface — it is a workaround that bypasses the type system to access functionality that should be accessible through a well-defined interface.

## Evidence

```typescript
// packages/query/src/TypedQueryable.ts:190
async paginate(page: number, size: number) {
  return await (
    this._queryable as unknown as {
      paginate: (page: number, size: number) => Promise<...>;
    }
  ).paginate(page, size);
}

// packages/query/src/TypedQueryable.ts:208
async keysetPaginate<TKey extends keyof TEntity>(...) {
  return await (
    this._queryable as unknown as {
      keysetPaginate: (...) => Promise<...>;
    }
  ).keysetPaginate(key, after, size);
}

// packages/query/src/TypedQueryable.ts:221
withAbort(signal: AbortSignal): TypedQueryable<TEntity> {
  const q = (
    this._queryable as unknown as { withAbort: (s: AbortSignal) => Queryable<TEntity> }
  ).withAbort(signal);
  return new TypedQueryable(q);
}

// packages/query/src/TypedQueryable.ts:70
return new TypedQueryable(resultQueryable as unknown as Queryable<TResult>);
```

In all four cases, `TypedQueryable` casts `this._queryable` to an ad-hoc structural type to call a method that is already public on `Queryable`. The cast exists because the generic type parameter mismatch (`Queryable<T>` vs the expected return type) cannot be resolved without an unsafe escape hatch.

## Why It Matters

- **Type-safety risk**: Each cast is a point where the compiler stops enforcing correctness. If `Queryable` renames `paginate` or changes its signature, `TypedQueryable` will silently break at runtime.
- **Maintainability**: Changes to `Queryable`'s method signatures must be manually mirrored in the ad-hoc cast interfaces inside `TypedQueryable`. There is no compile-time guarantee they stay in sync.
- **Abstraction leak**: The wrapper is tightly coupled to the concrete `Queryable` class (it holds `_queryable: Queryable<T>` directly). If `Queryable` is ever split (see ISSUE-001), `TypedQueryable` must be rewritten.
- **Testing risk**: The cast interfaces cannot be type-checked by the test suite — only runtime failures reveal signature mismatches.

## Recommended Fix

Extract a shared interface that both `Queryable<T>` and `TypedQueryable<TEntity>` implement:

```typescript
// packages/query/src/IQueryable.ts
export interface IQueryable<T> {
  paginate(page: number, size: number): Promise<PaginationResult<T>>;
  keysetPaginate<TKey extends keyof T>(key: TKey, after: T[TKey] | null, size: number): Promise<KeysetResult<T, TKey>>;
  withAbort(signal: AbortSignal): IQueryable<T>;
  toArray(): Promise<T[]>;
  // ...other execution methods
}
```

`Queryable<T>` implements `IQueryable<T>`. `TypedQueryable<TEntity>` holds `IQueryable<TEntity>` and delegates without casts. Generic return types (`selectCompiled`) can use the interface with covariant output.

Alternatively, if `TypedQueryable` only narrows types, consider making it a thin generic wrapper function rather than a full class:

```typescript
export function typed<T>(q: Queryable<T>): TypedQueryable<T> { ... }
```

## Acceptance Criteria

- `TypedQueryable` contains zero `as unknown as` casts
- A shared `IQueryable<T>` interface (or equivalent) is defined and implemented by `Queryable<T>`
- All `TypedQueryable` delegation compiles without escape hatches
- Existing tests continue to pass
