# ISSUE-002: `DbContext` God Object

## Severity

Critical

## Category

- SOLID
- Clean Architecture
- Maintainability
- Testability

## Location

- `packages/orm/src/DbContext.ts` (1102 lines)

## Problem

`DbContext` accumulates at least seven distinct architectural responsibilities into a single abstract class:

1. **Entity set registry** — auto-generating `DbSet<T>` properties from metadata, managing `_dbSets` and `_decoratedDbSets` maps
2. **Change tracking orchestration** — delegating to `ChangeTracker`, normalizing changes, prefilling defaults
3. **Three-tier cache management** — owns `EnhancedSqlCache` (`_ownedSqlCache`), `InMemoryCountCache`, and `EntityCache` (`_entityCache`), including complex invalidation logic across all three
4. **Validation** — `ChangeValidationService`, `_validationRulesCache`, `validateChanges()`, decorator-based `@ValidIf` resolution
5. **Audit** — `applyAudit()`, `applyCreatedAudit()`, `applyUpdatedAudit()`, tracking `createdAt`/`updatedAt`/`createdBy`/`updatedBy` columns
6. **Soft delete** — `handleSoftDelete()`, propagating soft-delete config to provider
7. **Transaction lifecycle** — `beginTransaction`, `commitTransaction`, `rollbackTransaction`, cache invalidation on commit

The constructor alone is ~90 lines and initializes a dozen collaborators directly.

## Evidence

```typescript
// packages/orm/src/DbContext.ts
private _changeTracker: ChangeTracker;
private _entityLoader: EntityLoader;
private _dbSets: Map<Function, DbSet<object>>;
private _decoratedDbSets: Map<Function, DbSet<object>>;
private _entityCache?: EntityCacheLike;
private _performanceOptions?: PerformanceOptions;
private _softDelete?: SoftDeleteOptions;
private _audit?: AuditOptions;
private _globalFilters?: GlobalFilter[];
private _diagnostics?: DiagnosticsOptions;
private _memoryProfiler?: MemoryProfilerLike;
private _validationService!: ChangeValidationService;
private _insertCmd!: InsertCommand;
private _updateCmd!: UpdateCommand;
private _deleteCmd!: DeleteCommand;
private _validationRulesCache: WeakMap<Function, ValidationRule[]>;
private _ownedSqlCache?: EnhancedSqlCache;
```

17 private fields. The `saveChanges()` method alone (line 237) invokes validation, audit, soft-delete, insert/update/delete commands, and cache invalidation — a full pipeline inside one method.

The `invalidateCachesOnCommit()` (line 355) and `invalidateSqlCacheByNames()` (line 426) show that cache invalidation logic has grown complex enough to require multiple dedicated private methods, yet they are all inside `DbContext`.

## Why It Matters

- **Testability**: Testing validation behavior requires instantiating a full `DbContext` with provider, caches, and change tracker. There is no seam to inject a stub validator.
- **Extensibility**: Adding a new cross-cutting concern (e.g., multi-tenancy row filter, row-level security) means modifying `DbContext`.
- **Coupling**: `DbContext` directly imports from `@ts-linq/query` (Queryable, QueryBuilder, InMemoryCountCache, EnhancedSqlCache), `@ts-linq/core` (EntityLoader, LazyLoadingProxy, EntityCache), and `@ts-linq/metadata` — it's a hub coupling all layers together.
- **Maintainability**: With 1102 lines, any PR touching persistence, caching, or validation risks touching this file.
- **API stability risk**: Every new feature that touches any of the 7 responsibilities listed above has to go through this class.

## Recommended Fix

Extract responsibilities into focused services, injected via `DbContextOptions`:

1. **`AuditService`** — applies audit columns on change (takes `AuditOptions`)
2. **`SoftDeleteService`** — applies soft delete on change (takes `SoftDeleteOptions`)
3. **`ValidationService`** (already exists as `ChangeValidationService`) — inject cleanly, remove inline validation from `DbContext`
4. **`CacheCoordinator`** — owns the three caches and their invalidation logic; `DbContext` receives it as a collaborator
5. **`DbSetRegistry`** — encapsulates auto-DbSet generation and the `_dbSets` / `_decoratedDbSets` maps

The `saveChanges()` pipeline then becomes a coordinator calling these services in order, rather than inline logic.

Incremental steps:
1. Extract cache invalidation into `CacheCoordinator` service
2. Extract audit into `AuditService`
3. Extract soft-delete into `SoftDeleteService`
4. Reduce `DbContext` to orchestration only

## Acceptance Criteria

- `DbContext.ts` is under 500 lines
- Each extracted service has its own unit tests, testable without a live provider
- `DbContextOptions` accepts injected service instances for testing
- `saveChanges()` is a pipeline of service calls, not inline logic
