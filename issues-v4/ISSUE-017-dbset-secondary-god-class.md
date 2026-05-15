# ISSUE-017: DbSet Is a Secondary God Class

## Severity

Medium

## Category

- SOLID
- Clean Code
- Maintainability

## Location

- `packages/orm/src/DbSet.ts`

## Problem

`DbSet<T>` is a 604-line class with **35 public methods** that provides an entity-scoped query and mutation API. The breadth of this API duplicates functionality already present on `DbContext` and `Queryable`, creating ambiguity about which class is responsible for which operations:

**Mutation methods** (overlap with `DbContext`):
`add`, `addRange`, `remove`, `removeRange`, `update`, `updateMany`, `updateRange`, `upsert`, `upsertMany`, `insertMany`

**Query methods** (overlap with `Queryable`):
`find`, `findByIds`, `findWhereIn`, `where`, `orderBy`, `orderByDescending`, `skip`, `take`, `first`, `firstOrDefault`, `single`, `singleOrDefault`, `any`, `count`, `distinct`, `include`, `select`, `toArray`, `union`, `unionAll`, `whereExists`, `whereInSubquery`

**Resilience**:
`fallbackTo`

**Cache**:
`invalidateCountCache`

Developers must decide whether to call `ctx.users.where(...)` vs. `ctx.users.where(...)` — the methods appear equivalent but may differ in subtle ways (global filter application, loading strategy defaults). The `DbSet` also holds a back-reference to its `DbSetContext` (a slice of `DbContext`), creating a bidirectional reference between `DbContext` and `DbSet`.

## Evidence

Serena symbol overview of `DbSet` shows 35 methods:
```
add, addRange, any, count, distinct, entityClass, fallbackTo, find,
findByIds, findWhereIn, first, firstOrDefault, include, insertMany,
invalidateCountCache, orderBy, orderByDescending, remove, removeRange,
select, single, singleOrDefault, skip, take, toArray, union, unionAll,
update, updateMany, updateRange, upsert, upsertMany, where, whereExists,
whereInSubquery
```

## Why It Matters

- **API surface ambiguity**: Both `DbContext` and `DbSet` expose query entry points; users learn two paths to the same operations.
- **Maintenance duplication**: Changes to query defaults (global filters, loading strategy) must be coordinated between `DbContext.find()`, `DbSet.find()`, and `Queryable`.
- **SRP violation**: `DbSet` mixes entity registration (change tracking via `add`/`remove`) with query construction, aggregation, and resilience.
- **Bidirectional coupling**: `DbSet` holding a `DbSetContext` (a slice of `DbContext`) creates a tight bidirectional dependency that makes either class hard to change independently.

## Recommended Fix

Reduce `DbSet<T>` to a focused entity-set accessor:
1. **Keep** `add`, `addRange`, `remove`, `removeRange`, `update` — these are the core unit-of-work operations that logically belong on `DbSet`.
2. **Remove** all query methods from `DbSet`; they should be accessed via `Queryable` returned from `DbContext`.
3. Provide a `query(): Queryable<T>` method on `DbSet` as the single entry point to entity-scoped querying:
   ```ts
   ctx.users.query().where(u => u.isActive).toArray()
   ```
4. Remove `fallbackTo` and `invalidateCountCache` — resilience and cache concerns belong in `Queryable` and `CacheCoordinator`.

## Acceptance Criteria

- `DbSet.ts` contains ≤ 10 public methods: mutation operations + `query()` entry point.
- No query-building logic exists in `DbSet`; all querying goes through `Queryable`.
- Bidirectional reference between `DbContext` and `DbSet` is broken; `DbSet` references only `ChangeTracker` and `DatabaseProvider`.
- Existing tests updated to use `ctx.users.query().where(...)` pattern.
