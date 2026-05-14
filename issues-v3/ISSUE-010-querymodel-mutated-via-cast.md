# ISSUE-010: `QueryModel` Mutated Through Unsafe Cast in `QueryExecutor`

## Severity

Medium

## Category

- Type System
- Clean Code
- Maintainability

## Location

- `packages/query/src/QueryExecutor.ts:50`
- `packages/query/src/QueryModel.ts` (QueryModel definition)

## Problem

`QueryModel` is documented and designed as an immutable query intent carrier — it accumulates query options through a `clone()` pattern where each builder method returns a new instance with the new option applied. This immutability is a core invariant of the query-building pipeline.

However, `QueryExecutor` breaks this invariant by mutating a `QueryModel` instance through an unsafe cast:

```typescript
// packages/query/src/QueryExecutor.ts:50
(model as unknown as { cte?: CteDefinition }).cte = cte;
```

This cast bypasses TypeScript's type system to write a property (`cte`) that does not appear in `QueryModel`'s public type. The mutation happens at execution time, meaning the same `QueryModel` instance used by the builder is modified by the executor — a violation of the immutable value-object contract.

## Evidence

The cast exists because `cte` was added to `QueryModel` in a way that either:
1. Was not reflected in the TypeScript type definition, or
2. Has a different visibility than what `QueryExecutor` can see

Either way, the result is that the executor reaches into a model object's internal state using an escape hatch, rather than receiving the CTE definition through a well-defined API.

A correct approach would be either:
- `QueryModel` exposes `cte` as a public readonly property with a `withCte()` builder method
- `QueryExecutor` receives the CTE separately from the model

## Why It Matters

- **Type-safety risk**: The cast silently bypasses the compiler. If `cte` is renamed or its type changes in `QueryModel`, `QueryExecutor` will silently assign the wrong shape and fail at runtime.
- **Immutability violation**: If the same `QueryModel` is shared between two concurrent query executions (which is possible via `Queryable.clone()`), the mutation in one executor will affect the other.
- **Maintainability**: Future developers reading the code have no way to know that `QueryModel` has a hidden `cte` field that is only visible through a cast. It will not appear in IDE auto-complete or type-checker output.
- **Testing risk**: Tests cannot assert that the CTE is correctly attached because the field is invisible to the type system.

## Recommended Fix

Add `cte` as a proper typed field on `QueryModel`:

```typescript
// packages/query/src/QueryModel.ts
export class QueryModel {
  readonly cte?: CteDefinition;
  // ...
  withCte(cte: CteDefinition): QueryModel {
    return { ...this, cte };
  }
}
```

`Queryable.withCte()` calls `this._model = this._model.withCte(cte)`. `QueryExecutor` reads `model.cte` without any cast.

Alternatively, if `cte` is an execution-time concern rather than a build-time concern, pass it as a parameter to the execution method:

```typescript
executor.execute(model, { cte });
```

## Acceptance Criteria

- `QueryExecutor.ts` contains no `as unknown as { cte?` pattern
- `QueryModel` exposes `cte` as a typed, public readonly property
- `Queryable.withCte()` uses the proper `QueryModel` builder API
- The mutation pattern is gone; no properties are set via cast anywhere in the query execution path
