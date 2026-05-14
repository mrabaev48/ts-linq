# ts-linq Architecture Audit v3

## Overview

This audit covers the full `ts-linq` monorepo: 33 packages, ~192 test files, three SQL dialects, a compile-time TypeScript transformer, and a layered ORM architecture. The audit examines clean architecture compliance, SOLID violations, type-system integrity, testability, dependency boundaries, and public API consistency.

The overall layer stack is:

```
@ts-linq/types         ← foundation, zero dependencies
  @ts-linq/metadata    ← entity/decorator metadata
  @ts-linq/ast         ← query AST + visitor pattern
    @ts-linq/core      ← decorators, loading, provider abstractions
      @ts-linq/query   ← Queryable, QueryBuilder, QueryExecutor, caches
        @ts-linq/orm   ← DbContext, DbSet, ChangeTracker
          providers    ← dialect-specific providers
          dialects     ← SQL generation (postgres, mysql, mssql)
```

The layering is fundamentally sound but several packages violate their own boundaries, two central classes have grown into God Objects, and the public API has invisible runtime dependencies on the build pipeline.

**18 issues identified.** 2 Critical, 5 High, 6 Medium, 5 Low.

---

## Issue Index

| ID | Severity | Category | Title | File |
|---|---|---|---|---|
| [ISSUE-001](ISSUE-001-queryable-god-object.md) | Critical | SOLID, Clean Architecture | `Queryable<T>` God Object | `packages/query/src/Queryable.ts` |
| [ISSUE-002](ISSUE-002-dbcontext-god-object.md) | Critical | SOLID, Clean Architecture | `DbContext` God Object | `packages/orm/src/DbContext.ts` |
| [ISSUE-003](ISSUE-003-runtime-throw-on-uncompiled-methods.md) | High | Public API, Clean Architecture | Public API methods throw at runtime without transformer | `packages/query/src/Queryable.ts` |
| [ISSUE-004](ISSUE-004-typed-queryable-private-cast-access.md) | High | Type System, SOLID | `TypedQueryable` accesses private internals via unsafe casts | `packages/query/src/TypedQueryable.ts` |
| [ISSUE-005](ISSUE-005-sqlhelper-wrong-layer.md) | High | Clean Architecture, Dependency Boundary | `SqlHelper` in `@ts-linq/core` forces dialects to depend on entire core | `packages/core/src/utils/SqlHelper.ts` |
| [ISSUE-006](ISSUE-006-disabled-plugin-packages.md) | High | Build/Tooling, Maintainability | Three plugin packages permanently build-disabled | `packages/plugin-*/package.json` |
| [ISSUE-007](ISSUE-007-provider-configs-in-types-package.md) | High | Clean Architecture, Dependency Boundary | Database-specific configs in `@ts-linq/types` | `packages/types/src/index.ts` |
| [ISSUE-008](ISSUE-008-metadata-storage-global-singleton.md) | Medium | Testability, Maintainability | `MetadataStorage` process-wide singleton | `packages/metadata/src/MetadataStorage.ts` |
| [ISSUE-009](ISSUE-009-query-executor-mixed-resilience.md) | Medium | SOLID, Maintainability | `QueryExecutor` mixes four resilience responsibilities | `packages/query/src/QueryExecutor.ts` |
| [ISSUE-010](ISSUE-010-querymodel-mutated-via-cast.md) | Medium | Type System, Clean Code | `QueryModel` mutated through unsafe cast in `QueryExecutor` | `packages/query/src/QueryExecutor.ts:50` |
| [ISSUE-011](ISSUE-011-pervasive-unsafe-casts.md) | Medium | Type System, Maintainability | 25+ `as unknown as` casts in production query code | `packages/query/src/` |
| [ISSUE-012](ISSUE-012-prometheus-endpoint-in-core.md) | Medium | Clean Architecture, SOLID | `PrometheusEndpoint` (HTTP server) in `@ts-linq/core` | `packages/core/src/utils/PrometheusEndpoint.ts` |
| [ISSUE-013](ISSUE-013-sql-visitor-placeholder-package.md) | Medium | Maintainability, Build/Tooling | `@ts-linq/sql-visitor` is an empty placeholder package | `packages/sql-visitor/src/index.ts` |
| [ISSUE-014](ISSUE-014-deprecated-noop-public-api.md) | Low | Public API, Clean Code | Deprecated no-op `clearCountCache()` in public API | `packages/query/src/Queryable.ts:134` |
| [ISSUE-015](ISSUE-015-types-barrel-bloat.md) | Low | Public API, Maintainability | `@ts-linq/types` is an unfocused 645-line barrel | `packages/types/src/index.ts` |
| [ISSUE-016](ISSUE-016-cache-owns-lifecycle.md) | Low | SOLID, Testability | `EnhancedSqlCache` owns its own cleanup interval lifecycle | `packages/query/src/EnhancedSqlCache.ts` |
| [ISSUE-017](ISSUE-017-join-predicate-runtime-throw.md) | Low | Public API, Documentation Drift | `innerJoin`/`leftJoin` predicate overloads always throw at runtime | `packages/query/src/Queryable.ts` |
| [ISSUE-018](ISSUE-018-cli-duck-typing.md) | Low | Type System, Clean Code | CLI uses duck-typing for `DbCommand` dispatch | `packages/cli/src/cli.ts:61` |

---

## Severity Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 5 |
| Medium | 6 |
| Low | 5 |
| **Total** | **18** |

---

## Top Architectural Risks

### 1. God Objects at the Core of Every User Interaction (ISSUE-001, ISSUE-002)

`Queryable<T>` (938 lines, 50+ methods) and `DbContext` (1102 lines, 7 responsibilities) are the two objects every consumer touches. Their size and complexity make them the primary source of coupling in the system. Any new feature, refactor, or bug fix is likely to pass through one of these two files.

### 2. Public API with Invisible Runtime Prerequisites (ISSUE-003, ISSUE-017)

`where()`, `select()`, `having()`, and join predicate overloads always throw at runtime if the ts-patch transformer is not configured. This is an invisible build-pipeline prerequisite encoded as a runtime error, not a type error. Consumers cannot discover this constraint from IntelliSense or the type system.

### 3. Type System Erosion in the Query Layer (ISSUE-004, ISSUE-010, ISSUE-011)

25+ `as unknown as` casts across `packages/query/src/` indicate that the internal contracts between query-layer classes are not expressed in the type system. This is a systemic risk: every cast is a point where compiler guarantees stop, and every cast must be manually verified during review.

### 4. Layer Boundary Violations (ISSUE-005, ISSUE-007, ISSUE-012)

- Dialects depend on `@ts-linq/core` for a stateless utility (`SqlHelper`)
- The zero-dependency `@ts-linq/types` package exports database-specific provider configs
- The core domain package exports an HTTP server endpoint (`PrometheusEndpoint`)

These violations mean the clean layer direction is broken in three places, increasing coupling and reducing the ability to use packages independently.

### 5. Undeveloped Plugin Architecture (ISSUE-006, ISSUE-013)

The plugin system (soft-delete, audit, multi-tenancy) is architecturally intended but practically dead: three packages are build-disabled, their functionality is baked into `DbContext`, and `@ts-linq/sql-visitor` is an empty placeholder. The gap between stated and actual architecture will widen as features continue to be added directly to `DbContext` instead of as plugins.

---

## Recommended Refactoring Order

Priority is based on impact (how many other improvements unlock), risk (how broken things are now), and effort.

### Phase 1: Stabilize boundaries (High leverage, low risk)

1. **ISSUE-005** — Move `SqlHelper` out of `@ts-linq/core` → dialects stop depending on core
2. **ISSUE-007** — Move provider configs to provider packages → `@ts-linq/types` becomes truly generic
3. **ISSUE-012** — Move `PrometheusEndpoint` to telemetry/prometheus package
4. **ISSUE-013** — Resolve `@ts-linq/sql-visitor` (remove placeholder or implement)
5. **ISSUE-018** — Replace CLI duck-typing with type guard

### Phase 2: Repair the type system (Medium effort, high payoff)

6. **ISSUE-010** — Expose `cte` as a typed field on `QueryModel`; remove mutation cast
7. **ISSUE-004** — Define `IQueryable<T>` interface; remove `TypedQueryable` unsafe casts
8. **ISSUE-011** — Address remaining `as unknown as` casts systematically
9. **ISSUE-003** — Document or type-enforce the transformer prerequisite
10. **ISSUE-017** — Remove or clearly mark join predicate overloads

### Phase 3: Decompose God Objects (High effort, transformative)

11. **ISSUE-001** — Decompose `Queryable<T>`: extract aggregates, pagination, resilience
12. **ISSUE-009** — Decompose `QueryExecutor`: extract resilience strategies
13. **ISSUE-016** — Extract `CacheEvictionScheduler` from `EnhancedSqlCache`
14. **ISSUE-002** — Decompose `DbContext`: extract `AuditService`, `SoftDeleteService`, `CacheCoordinator`

### Phase 4: Plugin architecture and cleanup

15. **ISSUE-006** — Fix or remove disabled plugin packages; extract soft-delete/audit from `DbContext`
16. **ISSUE-008** — Improve `MetadataStorage` test isolation; enforce `reset()` in test setup
17. **ISSUE-015** — Split `@ts-linq/types` barrel into sub-modules
18. **ISSUE-014** — Remove deprecated no-op `clearCountCache()` in next major version

---

## Notes

- **Assumption**: `@ts-linq/sql-visitor` placeholder content was read directly from source; it is possible the package is intentionally stubbed for future development. If there is a design document for it, ISSUE-013 severity may be reduced to Low.
- **Assumption**: The `as unknown as` cast count (25+) was computed from grep over production source files only, excluding `tests/`, `tests-new/`, and `test-d/` directories. The count in tests is higher but less concerning.
- **Out of scope**: The transformer implementation in `packages/transformer/` (compile-time ts-patch plugin) was reviewed at a high level. A deep audit of the TypeScript AST manipulation code is a separate concern.
- **Not found**: No circular dependencies were detected in the package graph. The layering is respected in the dependency graph even where the exported surface violates it.
- **Version context**: All packages are at `v2.0.0-alpha.1`. The alpha status means breaking changes are acceptable, and the recommended fixes in Phase 1–2 can be made without a major version bump.
