# ISSUE-009: Cache Coherency Logic Scattered Across DbContext

## Severity

High

## Category

- SOLID
- Maintainability
- Testability

## Location

- `packages/orm/src/DbContext.ts`
  - `invalidateCachesAfterSave()` (~line 366)
  - `invalidateCachesOnCommit()` (~line 301 area)
  - `invalidateCountCacheByNames()`
  - `invalidateSqlCacheByNames()`
  - `computeNeedFullL2Clear()`
  - `removeDeletedFromEntityCache()`
  - `removeFromEntityCache()`
  - `updateEntityCache()`

## Problem

`DbContext` manages three independent caches:
1. **L2 entity cache** (`_entityCache`) — stores deserialized entity objects
2. **SQL generation cache** (`_ownedSqlCache`, type `EnhancedSqlCache`) — caches compiled SQL strings
3. **Count cache** (`_externalCountCache`, accessed via Queryable) — caches `COUNT(*)` results

The coherency policy for these three caches is spread across **8 separate methods** in `DbContext`, called from at least three distinct code paths:

- After `saveChanges()` → `invalidateCachesAfterSave()`
- After `commitTransaction()` → `invalidateCachesOnCommit()`
- After `rollbackTransaction()` → separate L2 and count cache clears
- Inside `processChange()` → `removeFromEntityCache()`, `updateEntityCache()`

There is no single place that answers: "given this set of changed entities, which caches need invalidation and why?" The logic is distributed, making it easy to add a fourth cache and miss updating one of the invalidation paths.

## Evidence

Serena symbol overview shows 8 cache-related methods on `DbContext`:
```
computeNeedFullL2Clear, invalidateCachesAfterSave, invalidateCachesOnCommit,
invalidateCountCacheByNames, invalidateSqlCacheByNames,
removeDeletedFromEntityCache, removeFromEntityCache, updateEntityCache
```

From source:
- `DbContext.ts:256` — `saveChanges()` calls `beginTransaction()` then `processChange()` per entity
- `DbContext.ts:287` — public `beginTransaction()` exists separately
- `DbContext.ts:366` — `invalidateCachesAfterSave()` called from `saveChanges()`
- `commitTransaction()` and `rollbackTransaction()` each call their own cache invalidation paths

## Why It Matters

- **Correctness risk**: If a new mutation path is added (e.g., bulk upsert), cache invalidation might be missed because there is no central policy to follow.
- **Testability**: Testing cache coherency requires running a full `saveChanges()` cycle; no focused unit exists.
- **Coupling**: Adding a fourth cache requires finding and updating all 3+ invalidation code paths in `DbContext`.
- **SRP violation**: Cache coherency is a distinct responsibility from change processing.

## Recommended Fix

Extract a `CacheCoordinator` class:

```ts
class CacheCoordinator {
  constructor(
    private entityCache: EntityCacheLike,
    private sqlCache: EnhancedSqlCache,
    private countCache: CountCacheLike
  ) {}

  invalidateAfterMutation(affectedEntityNames: string[]): void { ... }
  invalidateAll(): void { ... }
  updateAfterInsert(entity: object, entityClass: Function): void { ... }
  removeAfterDelete(entity: object, entityClass: Function): void { ... }
}
```

`DbContext` holds a single `_cacheCoordinator` reference and delegates all cache operations to it.

## Acceptance Criteria

- All cache invalidation logic lives in a single `CacheCoordinator` class.
- `DbContext` contains no direct `cache.invalidate*` or `cache.remove*` calls outside of delegating to `CacheCoordinator`.
- Adding a new cache requires changing only `CacheCoordinator`.
- `CacheCoordinator` is unit-testable with mock cache implementations.
