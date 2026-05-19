# ISSUE-004: DbContext God Class

## Severity

Critical

## Category

- SOLID
- Clean Code
- Maintainability
- Testability

## Location

- `packages/orm/src/DbContext.ts`

## Problem

`DbContext` is the largest class in the codebase at 1102 lines with **48 methods** and **23 properties**. It is the central unit-of-work class but it has absorbed every cross-cutting ORM concern:

1. **Unit of work / change tracking**: `saveChanges`, `trySaveChanges`, `processChange`, `normalizeChange`
2. **Transaction management**: `beginTransaction`, `commitTransaction`, `rollbackTransaction`
3. **Schema management**: `ensureCreated`
4. **Query shortcuts**: `find`, `findAll`, `include`
5. **DbSet lifecycle**: `set`, `initializeDbSets`, `buildDbSetContext`
6. **Audit columns**: `applyAudit`, `applyCreatedAudit`, `applyUpdatedAudit`, `extractAuditNames`, `canBeSatisfiedByAudit`
7. **Soft delete**: `handleSoftDelete`, `applyDelete`
8. **Validation**: `validateChanges`, `validateComputedColumn`, `validateNullAndLength`, `runConditionalValidations`, `buildValidationDetail`, `normalizeForValidation`, `getValidationRules`
9. **Cache coherency**: `invalidateCachesAfterSave`, `invalidateCachesOnCommit`, `invalidateCountCacheByNames`, `invalidateSqlCacheByNames`, `computeNeedFullL2Clear`, `removeDeletedFromEntityCache`, `removeFromEntityCache`, `updateEntityCache`
10. **Loading strategy**: `setLoadingStrategy`
11. **Diagnostics / memory profiling**: logic around `_diagnostics`, `_memoryProfiler`

The `saveChanges` method alone orchestrates all of audit, soft-delete, validation, change processing, and cache invalidation in sequence.

## Evidence

Serena symbol overview of `DbContext` shows 48 methods:
```
applyAudit, applyCreatedAudit, applyDelete, applyInsert, applyUpdate,
applyUpdatedAudit, beginTransaction, buildDbSetContext, buildValidationDetail,
canBeSatisfiedByAudit, changeTracker, commitTransaction, computeNeedFullL2Clear,
dispose, ensureCreated, entityLoader, extractAuditNames, find, findAll,
getPrimaryKey, getValidationRules, handleSoftDelete, hasProperty, include,
initializeDbSets, invalidateCachesAfterSave, invalidateCachesOnCommit,
invalidateCountCacheByNames, invalidateSqlCacheByNames, isGeneratedPrimaryKey,
isLoaded, normalizeChange, normalizeForValidation, prefillDefaults,
processChange, provider, removeDeletedFromEntityCache, removeFromEntityCache,
rollbackTransaction, runConditionalValidations, saveChanges, set,
setLoadingStrategy, trySaveChanges, updateEntityCache, validateChanges,
validateComputedColumn, validateNullAndLength
```

Properties show direct mixing of infrastructure and policy concerns:
```
_audit, _softDelete, _validationOptions,    // policies
_entityCache, _ownedSqlCache,               // caches
_changeTracker, _insertCmd, _updateCmd, _deleteCmd,  // UoW
_memoryProfiler, _diagnostics              // observability
```

## Why It Matters

- **Testability**: Instantiating `DbContext` for a single unit test requires a full `DatabaseProvider`, `MetadataStorage`, and all policy options. No part of the class can be tested in isolation.
- **Extensibility risk**: Adding a new cross-cutting feature (e.g., row-level security) requires modifying `DbContext` directly.
- **SRP violation**: Audit, validation, soft-delete, and cache coherency are independently useful features that should be injectable.
- **Coupling**: Audit, soft-delete, and validation logic are hardcoded, not pluggable — violates Open/Closed Principle.

## Recommended Fix

Apply the Decorator / Middleware pattern that `OrmMiddleware` in `@ts-linq/types` already anticipates:

1. Extract `AuditInterceptor` — handles `applyAudit`, `applyCreatedAudit`, `applyUpdatedAudit`.
2. Extract `SoftDeleteInterceptor` — handles `handleSoftDelete`, `applyDelete`.
3. Extract `ValidationInterceptor` — handles all `validate*` and `runConditionalValidations` methods.
4. Extract `CacheCoordinator` — owns all four cache references and their invalidation policy (see also ISSUE-009).
5. `DbContext.saveChanges()` should invoke an ordered chain of interceptors, not inline each concern.

## Acceptance Criteria

- `DbContext.ts` contains ≤ 20 public methods covering only UoW, transaction, and lifecycle concerns.
- Audit, soft-delete, and validation logic live in separate injectable classes.
- `CacheCoordinator` owns all cache invalidation (ISSUE-009 resolved).
- Each extracted class is independently unit-testable without a `DatabaseProvider`.
