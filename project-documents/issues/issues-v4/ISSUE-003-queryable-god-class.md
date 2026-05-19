# ISSUE-003: Queryable God Class

## Severity

Critical

## Category

- SOLID
- Clean Code
- Maintainability
- Testability

## Location

- `packages/query/src/Queryable.ts`

## Problem

`Queryable<T>` is a single class with **55 methods** and **23 properties** spanning 938 lines. It combines the following distinct responsibilities:

1. **Fluent query building**: `where`, `orderBy`, `groupBy`, `having`, `skip`, `take`, `select`, `distinct`, `include`
2. **Set operations**: `union`, `unionAll`, `except`, `intersect`, `concat`
3. **Terminal execution**: `toArray`, `count`, `first`, `firstOrDefault`, `single`, `singleOrDefault`, `any`, `all`, `tryFirst`, `trySingle`
4. **Aggregations**: `sum`, `min`, `max`, `average`
5. **Pagination**: `paginate`, `keysetPaginate`
6. **Join building**: `innerJoin`, `leftJoin`, `innerJoinOn`, `leftJoinOn`
7. **CTE building**: `withCte`
8. **Resilience / fallback**: `fallbackTo`, `withFallbackPolicy`
9. **Abort signal**: `withAbort`
10. **Compiled expression variants**: `whereCompiled`, `havingCompiled`, `selectCompiled`
11. **Internal utilities**: `buildColumnResolver`, `buildCountCacheKey`, `clearCountCache`, `resolveColumnName`, `applyGlobalFiltersToModel`

A class with this many responsibilities is impossible to unit-test in isolation — any test must configure all constructor dependencies (`DatabaseProvider`, `EntityLoader`, `MetadataStorage`, `EntityCache`, `GlobalFilterApplier`, etc.) even to test a single method.

## Evidence

Serena symbol overview shows 55 methods on `Queryable`:
```
all, any, applyGlobalFiltersToModel, average, buildColumnResolver,
buildCountCacheKey, clearCountCache, clone, concat, contains, count,
distinct, except, fallbackTo, first, firstOrDefault, groupBy, having,
havingCompiled, include, innerJoin, innerJoinOn, intersect, keysetPaginate,
leftJoin, leftJoinOn, max, min, orderBy, orderByDescending, paginate,
resolveColumnName, select, selectCompiled, single, singleOrDefault,
skip, sum, take, thenBy, thenByDescending, toArray, tryFirst, trySingle,
union, unionAll, where, whereCompiled, whereExists, whereIn, whereInSubquery,
withAbort, withCte, withFallbackPolicy
```

Properties show direct mixing of concerns:
```
_fallbacks, _throttle,          // resilience
_materializer, _executor,       // execution
_sqlBuilder, _model,            // query building
_entityCache, _entityLoader,    // loading
_globalFilterApplier,           // filtering
_aggregates, _includePlanner    // aggregation/loading
```

## Why It Matters

- **Testability**: Every unit test for any single feature must wire up all 12+ constructor dependencies.
- **Maintainability**: Adding a new query feature risks interfering with execution, fallback, or caching logic in the same file.
- **SRP violation**: Fluent API, execution, fallback orchestration, and pagination are distinct concerns and should be independently replaceable.
- **Extensibility**: Third-party consumers cannot extend just the fluent API surface without inheriting execution and resilience logic.

## Recommended Fix

Decompose by responsibility:

1. Keep `Queryable<T>` as the fluent API surface — retain only query-building methods. Each fluent method returns a new `Queryable` built from a `QueryModel`.
2. `QueryExecutor` already exists — move terminal execution logic (fallback, hedging, abort) entirely there; `Queryable` delegates via `this._executor.execute(model, options)`.
3. Extract a `FallbackManager` from `_fallbacks` and `_throttle` logic.
4. Move `paginate` / `keysetPaginate` to a `PaginationQueryable` mixin or dedicated builder.
5. Move aggregate terminal methods (`sum`, `min`, `max`, `average`) to `AggregateOperations` (already exists as a separate class — use it consistently).

## Acceptance Criteria

- `Queryable.ts` contains ≤ 25 public methods (fluent builders + essential terminals).
- `fallbackTo`, `_throttle`, fallback logic live in `QueryExecutor` or `FallbackManager`.
- Aggregate terminals delegate entirely to `AggregateOperations`.
- Unit tests for individual query-building methods require only `QueryModel`, not a full provider.
