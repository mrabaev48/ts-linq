# ISSUE-001: `Queryable<T>` God Object

## Severity

Critical

## Category

- SOLID
- Clean Architecture
- Maintainability
- Testability

## Location

- `packages/query/src/Queryable.ts` (938 lines)

## Problem

`Queryable<T>` violates the Single Responsibility Principle by combining at least six distinct concerns into one class:

1. **Query building** — `where`, `whereIn`, `whereCompiled`, `whereExists`, `whereInSubquery`, `select`, `orderBy`, `groupBy`, `having`, `distinct`, `take`, `skip`
2. **Set operations** — `union`, `unionAll`, `intersect`, `except`, `concat`
3. **Relationship loading** — `include`
4. **Aggregate execution** — `count`, `sum`, `average`, `min`, `max`, `any`, `all`, `contains`
5. **Pagination** — `paginate` (page/size), `keysetPaginate` (cursor-based)
6. **Resilience / fallback** — `fallbackTo`, `withFallbackPolicy`, `withAbort`

The class also directly owns shared throttle state (`_throttleState`) that is passed by reference across cloned instances, and holds a `_globalFilterApplier` that modifies the query model on execution.

## Evidence

```typescript
// packages/query/src/Queryable.ts
export class Queryable<T> {
  // 50+ public methods, including:
  public where(...)         // → throws without transformer
  public whereIn(...)       // works at runtime
  public select(...)        // → throws without transformer
  public paginate(...)      // async execution
  public keysetPaginate(...)// async execution with cursor
  public count()            // async aggregate
  public sum(...)           // async aggregate
  public fallbackTo(...)    // resilience wiring
  public withAbort(...)     // cancellation
  public include(...)       // eager loading
  public union(...)         // set operation
  public static clearCountCache() // deprecated no-op (see ISSUE-014)
}
```

The `clone()` method (line 139) manually copies 15+ fields, which is a sign that the class carries too much state for a single responsibility.

## Why It Matters

- **Maintainability**: Any change to pagination, aggregates, or resilience logic touches the same 938-line file. Merge conflicts are inevitable.
- **Testability**: Unit-testing `count()` requires constructing a full `Queryable` instance with a provider, loader, cache, throttle state — none of which are necessary for testing aggregation logic.
- **Extensibility**: Adding a new query capability (e.g., window functions) or a new execution strategy (e.g., streaming) requires modifying the central class rather than extending a focused abstraction.
- **API stability**: The public surface of `Queryable` is extremely broad. Every method is a potential breaking-change point.
- **Coupling**: Pagination logic (`keysetPaginate`) has direct knowledge of entity primary key metadata — a metadata concern embedded in the query builder.

## Recommended Fix

Decompose `Queryable<T>` into focused collaborators:

1. **`QueryBuilder<T>`** (already partially exists) — pure query model construction (where, select, orderBy, groupBy, join, take, skip, distinct, set ops)
2. **`AggregateQueryable<T>`** — `count`, `sum`, `average`, `min`, `max`, `any`, `all`, `contains` — thin delegating methods
3. **`PaginatedQueryable<T>`** — `paginate`, `keysetPaginate`
4. **`ResilientQueryable<T>`** or move fallback to `QueryExecutor` — `fallbackTo`, `withFallbackPolicy`, `withAbort`

`Queryable<T>` itself becomes a thin facade composing these roles, or the API surface is split at the fluent-builder level.

Incremental steps:
1. Extract aggregate methods into `AggregateOperations` helper (file already exists at `packages/query/src/AggregateOperations.ts` — delegate from `Queryable`)
2. Extract `paginate` / `keysetPaginate` into `PaginationOperations`
3. Move resilience wiring (`fallbackTo`, throttle) into `QueryExecutor`

## Acceptance Criteria

- `Queryable.ts` is under 400 lines
- Each extracted class has a single clear responsibility with its own unit tests
- `Queryable` public API remains backward-compatible (methods may delegate internally)
- Clone logic copies fewer than 8 fields
