# ISSUE-015: `@ts-linq/types` Is an Unfocused 645-Line Barrel with 70 Exports

## Severity

Low

## Category

- Public API
- Maintainability
- Clean Architecture

## Location

- `packages/types/src/index.ts` (645 lines, ~70 exports)

## Problem

`@ts-linq/types` is the zero-dependency foundation package. Its stated purpose is to hold pure, shared type definitions. However, its `index.ts` exports a wide and unrelated mix of concerns:

- **SQL execution types**: `SqlParameter`, `SqlQueryResult`, `SqlWithParams`, `SqlWithReturning`
- **Query builder types**: `QueryOptions`, `WhereClause`, `JoinClause`, `OrderByClause`, `GroupByClause`, `SelectClause`, `HavingClause`
- **Entity metadata types**: `ColumnMetadata`, `EntityMetadata`, `RelationshipMetadata`, `IndexMetadata`
- **Provider configuration**: `PostgresConfig`, `MySqlConfig`, `MssqlConfig`, `BaseProviderConfig` (see also ISSUE-007)
- **Error classes**: `ValidationError`, `EntityNotFoundError`, `QueryError`
- **Cache interfaces**: `SqlCache`, `CountCache`, `EntityCacheLike`, `SqlCacheMetrics`
- **Performance/resilience**: `PerformanceOptions`, `FallbackPolicy`, `QueryFallback`, `SoftDeleteOptions`, `AuditOptions`
- **Cross-cutting utilities**: `Result<T, E>`, `ok()`, `err()` (Result monad)
- **Observability**: `SqlLogger`, `OrmMiddleware`
- **Loading**: `LoadingDefaults`

The barrel pattern without domain grouping means:
1. A new contributor cannot determine what `@ts-linq/types` is "about"
2. Adding a new type requires deciding whether it belongs in this barrel or a dedicated package — there is no clear rule
3. Any consumer importing a single type from `@ts-linq/types` gets the entire 70-export surface in their IDE auto-complete

## Evidence

```
645 lines
~70 named exports
Domains represented: SQL, query, metadata, config, errors, cache, performance, observability, loading, utilities
```

## Why It Matters

- **Maintainability**: The barrel is a catch-all that grows without constraint. Every new cross-cutting type ends up here by default.
- **API clarity**: Consumers cannot determine from the package name or exports what "types" means — it is effectively a global namespace.
- **Extensibility risk**: When a third-party provider wants to depend only on SQL parameter types, it must take the entire metadata/cache/config surface as an implicit peer.

## Recommended Fix

Segment `@ts-linq/types` into sub-modules (without creating new packages):

```typescript
// packages/types/src/sql.ts       — SqlParameter, SqlQueryResult, SqlWithParams
// packages/types/src/query.ts     — QueryOptions, WhereClause, JoinClause, etc.
// packages/types/src/metadata.ts  — ColumnMetadata, EntityMetadata, etc.
// packages/types/src/cache.ts     — SqlCache, CountCache, EntityCacheLike
// packages/types/src/errors.ts    — ValidationError, EntityNotFoundError, QueryError
// packages/types/src/result.ts    — Result<T,E>, ok(), err()
// packages/types/src/index.ts     — re-exports all of the above (backward-compatible)
```

This does not break any consumer imports (they all import from `@ts-linq/types`) but gives contributors clear sub-module boundaries for adding new types, and allows future splitting into separate packages if needed.

Move provider-specific configs to their respective packages (see ISSUE-007).

## Acceptance Criteria

- `packages/types/src/` contains sub-module files grouping related types
- `packages/types/src/index.ts` re-exports from sub-modules (no type definitions inline)
- `PostgresConfig`, `MySqlConfig`, `MssqlConfig` are removed from this package (see ISSUE-007)
- The `index.ts` barrel is under 100 lines (just re-exports)
- No new type definitions are added directly to `index.ts`
