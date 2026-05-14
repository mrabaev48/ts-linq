# ISSUE-005: `SqlHelper` in `@ts-linq/core` Forces Dialects to Depend on the Entire Core Layer

## Severity

High

## Category

- Clean Architecture
- Dependency Boundary
- Maintainability

## Location

- `packages/core/src/utils/SqlHelper.ts`
- `packages/dialect-postgres/src/PostgresDdlStrategy.ts:2`
- `packages/dialect-mysql/src/MySqlDdlStrategy.ts:2`
- `packages/dialect-mssql/src/MssqlDdlStrategy.ts:2`

## Problem

All three SQL dialect packages import `SqlHelper` from `@ts-linq/core`:

```typescript
import { SqlHelper } from '@ts-linq/core';
```

`SqlHelper` is a stateless utility class that builds WHERE clauses from plain conditions. It has no dependency on entity decorators, loading strategies, or provider abstractions. Yet it lives in `@ts-linq/core`, which also exports:

- `@Entity`, `@Column`, `@PrimaryKey`, `@OneToMany`, etc.
- `EntityLoader`, `LazyLoadingProxy`
- `DatabaseProvider`, `DdlBuilder`, `DdlStrategy`
- `EntityCache`, `RetryPolicies`, `PrometheusEndpoint`

By placing `SqlHelper` in `core`, all three dialect packages must take on `@ts-linq/core` as a full dependency — including reflection metadata setup, decorator infrastructure, and all loading-strategy code — just to use a few lines of SQL string building.

This contradicts the intended layer boundary where dialects should only depend on `@ts-linq/types` and potentially `@ts-linq/metadata` for column name resolution.

## Evidence

Current dependency graph (actual):
```
dialect-postgres → @ts-linq/core (for SqlHelper)
               → @ts-linq/metadata
               → @ts-linq/types

@ts-linq/core  → @ts-linq/metadata
               → @ts-linq/types
               → @ts-linq/metrics-safe
               → @ts-linq/ast
```

Expected dependency graph (clean):
```
dialect-postgres → @ts-linq/types (only)
               → @ts-linq/metadata (for column resolution)
```

`SqlHelper` content (packages/core/src/utils/SqlHelper.ts):
- `buildWhereClause(conditions)` — builds `col = ?` / `col IS NULL` / `col IN (?, ?, ?)` fragments
- `buildInlineValue(value)` — escapes a value for inline SQL (no parameterization)
- No imports from decorators, loaders, or any other core abstraction

## Why It Matters

- **Dependency boundary risk**: Dialects become entangled with the entire decorator/loading infrastructure. Any breaking change in core decorator APIs affects dialect builds.
- **Bundle size risk**: Applications using only one dialect unnecessarily pull in the full decorator and loading-strategy infrastructure.
- **Extensibility risk**: Adding a new dialect in the future requires depending on `@ts-linq/core`, which may not be appropriate for a lightweight dialect adapter.
- **Coupling risk**: The clean layer direction (`types → core → query → orm → providers`) is violated by having dialects depend on `core` rather than just `types`.

## Recommended Fix

Move `SqlHelper` to `@ts-linq/types` (which already has `SqlParameter` type that `SqlHelper` uses) or create a minimal `@ts-linq/sql-utils` package:

**Option A** — Move to `@ts-linq/types`:
- `SqlHelper` only uses `SqlParameter` from `@ts-linq/types`
- Moving it there eliminates the `core` dependency from dialects entirely

**Option B** — Extract to `@ts-linq/sql-utils`:
- New package with zero dependencies beyond `@ts-linq/types`
- All three dialects depend on `@ts-linq/sql-utils` instead of `@ts-linq/core`
- `@ts-linq/core` re-exports from `@ts-linq/sql-utils` for backward compatibility

Option A is simpler. Option B is cleaner if `SqlHelper` is expected to grow.

## Acceptance Criteria

- Dialect packages (`dialect-postgres`, `dialect-mysql`, `dialect-mssql`) no longer list `@ts-linq/core` as a dependency in `package.json`
- `SqlHelper` is importable from a package that has no decorator/loader infrastructure
- All existing dialect tests pass
- `@ts-linq/core` re-exports `SqlHelper` from its new location for backward compatibility
