# ts-linq Architecture Audit v4

## Overview

Full architectural audit of the `ts-linq` TypeScript ORM monorepo. The audit covers all 34 packages across every architectural layer: type contracts, metadata, AST, query building, ORM unit-of-work, SQL dialects, database providers, plugins, caching, CLI, and build/tooling infrastructure.

**Date**: 2026-05-15  
**Tooling**:
- madge 8.x (`pnpm arch:cycles`) — circular dependency detection
- dependency-cruiser 17.x (`pnpm arch:deps`) — architectural rule validation
- ts-prune 0.10.x (`pnpm arch:dead`) — dead export detection
- TypeScript 5.4.x + Serena LSP — symbol-level code analysis

**Findings**: 23 issues (7 Critical, 8 High, 6 Medium, 2 Low)

---

## Issue Index

| ID | Severity | Category | Title | File |
|----|----------|----------|-------|------|
| ISSUE-001 | ~~Critical~~ | ~~Dependency Boundary, Clean Architecture~~ | ~~Circular dependency in @ts-linq/core~~ ✅ **FIXED** | [ISSUE-001-core-circular-dependency.md](ISSUE-001-core-circular-dependency.md) |
| ISSUE-002 | ~~Critical~~ | ~~Dependency Boundary, Clean Architecture~~ | ~~Type duplication between @ts-linq/core and @ts-linq/types~~ ✅ **FIXED** | [ISSUE-002-type-duplication-core-vs-types.md](ISSUE-002-type-duplication-core-vs-types.md) |
| ISSUE-003 | Critical | SOLID, Clean Code, Maintainability | Queryable god class (55 methods, 938 LOC) | [ISSUE-003-queryable-god-class.md](ISSUE-003-queryable-god-class.md) |
| ISSUE-004 | Critical | SOLID, Clean Code, Maintainability | DbContext god class (48 methods, 1102 LOC) | [ISSUE-004-dbcontext-god-class.md](ISSUE-004-dbcontext-god-class.md) |
| ISSUE-005 | ~~Critical~~ | ~~Clean Architecture, Maintainability~~ | ~~@ts-linq/sql-visitor is an unimplemented stub~~ ✅ **FIXED** | [ISSUE-005-sql-visitor-stub.md](ISSUE-005-sql-visitor-stub.md) |
| ISSUE-006 | ~~Critical~~ | ~~Clean Architecture, Dependency Boundary~~ | ~~AST visitors hardcode SQL syntax~~ ✅ **FIXED** | [ISSUE-006-ast-visitors-hardcode-sql.md](ISSUE-006-ast-visitors-hardcode-sql.md) |
| ISSUE-007 | ~~High~~ | ~~Build/Tooling, Maintainability~~ | ~~Dynamic require() in DbContext is ESM-incompatible~~ ✅ **FIXED** | [ISSUE-007-dynamic-require-esm-incompatible.md](ISSUE-007-dynamic-require-esm-incompatible.md) |
| ISSUE-008 | ~~High~~ | ~~Dependency Boundary, Build/Tooling~~ | ~~CLI eagerly imports all three database providers~~ ✅ **FIXED** | [ISSUE-008-cli-eager-loads-all-providers.md](ISSUE-008-cli-eager-loads-all-providers.md) |
| ISSUE-009 | High | SOLID, Maintainability | Cache coherency logic scattered across DbContext | [ISSUE-009-cache-coherency-scattered.md](ISSUE-009-cache-coherency-scattered.md) |
| ISSUE-010 | High | SOLID, Testability | Mutable shared state in Queryable.clone() | [ISSUE-010-queryable-clone-shared-mutable-state.md](ISSUE-010-queryable-clone-shared-mutable-state.md) |
| ISSUE-011 | High | Testability, Clean Architecture | MetadataStorage singleton causes test pollution | [ISSUE-011-metadata-storage-singleton.md](ISSUE-011-metadata-storage-singleton.md) |
| ISSUE-012 | ~~High~~ | ~~Build/Tooling, Testability~~ | ~~Jest and TypeScript resolve packages from different paths~~ ✅ **FIXED** | [ISSUE-012-jest-tsconfig-path-divergence.md](ISSUE-012-jest-tsconfig-path-divergence.md) |
| ISSUE-013 | ~~High~~ | ~~Build/Tooling, Maintainability~~ | ~~@ts-linq/telemetry is a dead stub (no src/)~~ ✅ **FIXED** | [ISSUE-013-telemetry-dead-stub.md](ISSUE-013-telemetry-dead-stub.md) |
| ISSUE-014 | Medium | SOLID, Maintainability | EnhancedSqlCache is an over-wide class (457 LOC, 19 methods) | [ISSUE-014-enhanced-sql-cache-overwide.md](ISSUE-014-enhanced-sql-cache-overwide.md) |
| ISSUE-015 | Medium | Build/Tooling, Maintainability | Per-package tsconfig path aliases duplicated 21+ times | [ISSUE-015-tsconfig-path-alias-duplication.md](ISSUE-015-tsconfig-path-alias-duplication.md) |
| ISSUE-016 | ~~Medium~~ | ~~Dependency Boundary, Build/Tooling~~ | ~~Phantom dependencies via TypeScript path aliases~~ ✅ **FIXED** | [ISSUE-016-phantom-deps-tsconfig-paths.md](ISSUE-016-phantom-deps-tsconfig-paths.md) |
| ISSUE-017 | Medium | SOLID, Clean Code | DbSet secondary god class (35 methods, 604 LOC) | [ISSUE-017-dbset-secondary-god-class.md](ISSUE-017-dbset-secondary-god-class.md) |
| ISSUE-018 | Medium | Maintainability, Testability | saveChanges() opens a transaction without checking for an active one | [ISSUE-018-savechanges-reentrant-transaction.md](ISSUE-018-savechanges-reentrant-transaction.md) |
| ISSUE-019 | Low | Maintainability, Documentation Drift | @ts-linq/integration-nestjs is an unimplemented placeholder | [ISSUE-019-integration-nestjs-placeholder.md](ISSUE-019-integration-nestjs-placeholder.md) |
| ISSUE-020 | Low | Clean Code, Maintainability | Global filters repeated at 12 terminal operation call sites | [ISSUE-020-global-filter-repeated-at-every-terminal-op.md](ISSUE-020-global-filter-repeated-at-every-terminal-op.md) |
| ISSUE-021 | Critical | Dependency Boundary, Clean Architecture | Circular dependencies in @ts-linq/migrations | [ISSUE-021-migrations-circular-dependency.md](ISSUE-021-migrations-circular-dependency.md) |
| ISSUE-022 | Medium | Maintainability, Clean Code | Orphan dead source files in @ts-linq/core and plugins | [ISSUE-022-orphan-dead-source-files.md](ISSUE-022-orphan-dead-source-files.md) |
| ISSUE-023 | High | Build/Tooling, Maintainability | dependency-cruiser rules produce 790 false-positive violations | [ISSUE-023-depcruiser-rules-misconfigured.md](ISSUE-023-depcruiser-rules-misconfigured.md) |

---

## Severity Summary

| Severity | Count |
|----------|-------|
| Critical | 7 |
| High | 8 |
| Medium | 6 |
| Low | 2 |
| **Total** | **23** |

---

## Top Architectural Risks

### 1. ~~AST–SQL Coupling (ISSUE-005 + ISSUE-006)~~ ✅ BOTH FIXED
~~The `@ts-linq/ast` package — which should be the dialect-agnostic expression layer — currently contains all SQL generation logic. The `@ts-linq/sql-visitor` package meant to own this logic is a stub.~~ Both issues are now resolved: all visitor classes (`BinaryVisitor`, `LogicalVisitor`, `UnaryVisitor`, `NullVisitor`, `InVisitor`, `MethodVisitor`) and `SqlVisitor` live in `@ts-linq/sql-visitor`; the AST package retains only pure node type definitions. A `ParameterStyle` enum (`Question`/`Positional`/`Named`) and `ParameterState` class were introduced in `@ts-linq/sql-visitor`, making `SqlVisitor` fully dialect-aware: `new SqlVisitor(ParameterStyle.Positional)` produces `$1, $2` placeholders natively.

### 2. God Classes in Query and ORM Layers (ISSUE-003 + ISSUE-004 + ISSUE-017)
`Queryable` (938 LOC, 55 methods), `DbContext` (1102 LOC, 48 methods), and `DbSet` (604 LOC, 35 methods) concentrate enormous scope in three classes. This makes unit testing impossible without full provider setup, violates SRP at every level, and creates a maintenance bottleneck where any new ORM feature requires modifying an already-large class.

### 3. Build and Test Infrastructure Misalignment (~~ISSUE-007~~ ✅ + ~~ISSUE-012~~ ✅ + ~~ISSUE-013~~ ✅ + ~~ISSUE-016~~ ✅ + ISSUE-015)
The build and test infrastructure has accumulated several independent problems: Jest and TypeScript resolve packages from different locations, ~~a package is referenced in Jest but has no source~~, ~~ESM-incompatible `require()` is used in production code~~ (both fixed), ~~path aliases masked undeclared dependencies~~ (fixed: stale `@ts-linq/metrics-safe` aliases removed from 6 tsconfig files; `scripts/check-phantom-deps.js` added to CI). ISSUE-015 (path alias duplication across 21+ tsconfigs) remains open.

### ~~4. Core Package Circular Dependency (ISSUE-001)~~ ✅ FIXED
~~The single confirmed circular dependency (`DatabaseProvider → HealthMonitor → ResilienceManager → types → DatabaseProvider`) is in the most foundational package. Cycles here affect all packages that depend on `@ts-linq/core` and produce non-deterministic build behavior.~~
Cycle broken by introducing `IDatabaseProvider` interface in `core/src/types/index.ts`. `DatabaseProvider` now implements the interface; `DbContextOptions.provider` is typed via the interface. `pnpm arch:cycles` reports zero circular dependencies.

### ~~5. Type Ownership Ambiguity (ISSUE-002)~~ ✅ FIXED
~~Having domain types (`EntityState`, `DbContextOptions`, `QueryStartInfo`, etc.) distributed between `@ts-linq/core/src/types` and `@ts-linq/types` means consumers must import from unpredictable locations, and any future versioning of either package may break the other.~~
`EntityState` and `TrackedEntity` moved to `@ts-linq/types` as canonical definitions. All 11 logger event type duplicates (`QueryStartInfo`, `QueryEndInfo`, `RetryInfo`, `CircuitState`, etc.) removed from `@ts-linq/core/src/types/index.ts`; `@ts-linq/core` now re-exports them from `@ts-linq/types` for backward compatibility. Internal files (`DatabaseProvider.ts`, `ResilienceManager.ts`) updated to import directly from `@ts-linq/types`.

---

## Recommended Refactoring Order

### Phase 1 — Unblock Correctness and Build (Weeks 1–2)
1. ~~**ISSUE-001** — Break the circular dependency in `@ts-linq/core` (prerequisite for clean builds)~~ ✅ Done
2. ~~**ISSUE-007** — Replace `require()` with static `import`; declare `@ts-linq/metrics-safe` as dep (ESM unblock)~~ ✅ Done
3. ~~**ISSUE-013** — Implement or remove `@ts-linq/telemetry` (unblock Jest)~~ ✅ Done
4. ~~**ISSUE-012** — Align Jest `moduleNameMapper` to `dist/` paths (test/build consistency)~~ ✅ Done

### Phase 2 — Fix Architectural Layer Violations (Weeks 3–5)
5. ~~**ISSUE-005**~~ ✅ Done — ~~**ISSUE-006**~~ ✅ Done — `ParameterStyle` enum introduced; `SqlVisitor` accepts dialect-specific placeholder style
6. ~~**ISSUE-002**~~ ✅ Done — Consolidated type ownership: 13 duplicate/domain types moved to `@ts-linq/types`, removed from `@ts-linq/core`; backward-compatible re-exports added
7. ~~**ISSUE-016**~~ ✅ Done — Removed stale `@ts-linq/metrics-safe` path aliases from 6 tsconfig files; added `scripts/check-phantom-deps.js` CI lint script; wired `no-undeclared-workspaces` rule in dependency-cruiser
8. ~~**ISSUE-008**~~ ✅ Done — Lazy-load providers in CLI; `createProviderFromEnv()` now async with dynamic `import()` per branch; providers moved to `optionalDependencies`

### Phase 3 — Reduce Complexity in Core Classes (Weeks 6–10)
9. **ISSUE-009** — Extract `CacheCoordinator` from `DbContext`
10. **ISSUE-004** — Decompose `DbContext` with extracted interceptors for audit, soft-delete, validation
11. **ISSUE-003** — Decompose `Queryable` with `FallbackManager` and delegation to `QueryExecutor`
12. **ISSUE-017** — Reduce `DbSet` to mutation + `query()` entry point

### Phase 4 — Polish and Test Safety (Weeks 11–12)
13. **ISSUE-011** — Document and enforce `MetadataStorage.reset()` in test lifecycle
14. **ISSUE-010** — Clarify or fix `_throttle` sharing semantics in `Queryable.clone()`
15. **ISSUE-018** — Add transaction depth tracking to `DbContext`
16. **ISSUE-014** — Decompose `EnhancedSqlCache` into composable decorators
17. **ISSUE-015** — Consolidate path aliases into `tsconfig.base.json`

### Phase 5 — Low Priority (Ongoing)
18. **ISSUE-020** — Extract `prepareQueryModel()` in `Queryable`
19. **ISSUE-019** — Implement or remove `@ts-linq/integration-nestjs`

---

## Notes

- **Dialect layer is clean**: `@ts-linq/dialect-postgres/mysql/mssql`, all provider packages, and all plugin packages (`plugin-audit`, `plugin-soft-delete`, `plugin-multi-tenant`) have correct dependency directions and no SRP violations. No findings were generated for these packages.
- **ts-prune returned empty output**: All exports in `packages/*/src/index.ts` are in `ts-prune-ignore.txt`. Placeholder exports in `sql-visitor`, `integration-nestjs`, and `telemetry` are covered by the ignore list and would not surface via dead-code analysis alone.
- **ISSUE-010 throttle sharing**: The comment in source explicitly documents this as intentional. The issue is flagged because concurrent access semantics are not analyzed anywhere in the codebase.
- **No findings for**: `@ts-linq/transformer` (clean, compile-time-only), `@ts-linq/pagination`, `@ts-linq/concurrency`, `@ts-linq/cache`, `@ts-linq/cache-redis`, `@ts-linq/cache-memcached`, `@ts-linq/migrations` — all follow correct dependency direction and have appropriate scopes.
