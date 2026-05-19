# ts-linq Architecture Audit v5

## Overview

This is a follow-on architectural audit performed after audit v4 (2026-05-15, 21 of 23 issues closed)
and after PR #66 "feat(orm): EF Core-style API with lambda selectors and direct DbSet querying"
(merged 2026-05-18). The goal is to surface structural problems that arose from — or were left
untouched by — the new EF-Core-style design and the post-v4 refactor wave.

**Date**: 2026-05-18
**Branch**: `audit/v5`
**Method**: read-only analysis. No production source files were modified.

### Tooling used as evidence

- `pnpm arch:cycles` (madge 8.x) — **0 circular dependencies** (228 files)
- `pnpm arch:deps` (dependency-cruiser 17.x) — **0 violations** (472 modules / 697 dependencies)
- `pnpm arch:dead` (ts-prune 0.10.x) — **0 reportable dead exports** (after `ts-prune-ignore.txt`)
- `pnpm typecheck` — **0 errors** (31 / 31 packages green)
- Serena MCP semantic LSP — symbol-level navigation and reference inspection
- Direct file reads — verified all line citations against current `main` (commit `3cb800ed`)

The mechanical tools are clean. This audit therefore focuses on **semantic structural risks** that
those tools cannot detect: Proxy-based DSL erosion, public API surface drift, god-class regressions,
silent failure modes, and type-system erosion.

---

## Issue Index

| ID | Severity | Category | Title | File |
|----|----------|----------|-------|------|
| ISSUE-001 ✅ | High | Type System, Clean Architecture | DbContext constructor returns a Proxy and bypasses the type system | [ISSUE-001-dbcontext-proxy-constructor-return.md](ISSUE-001-dbcontext-proxy-constructor-return.md) |
| ISSUE-002 ✅ | High | Type System, Public API, Testability | `extractKey()` silently drops all but the first property access in selector lambdas | [ISSUE-002-extract-key-first-property-only.md](ISSUE-002-extract-key-first-property-only.md) |
| ISSUE-003 | High | SOLID, Clean Code | `DbSet` regressed to a god class after PR #66 (53 public methods, 515 LOC) | [ISSUE-003-dbset-god-class-regression.md](ISSUE-003-dbset-god-class-regression.md) |
| ISSUE-004 ✅ | Medium | Public API, Testability | `IncludePlanner.loadLevel()` silently skips unknown navigation properties | [ISSUE-004-include-planner-silent-skip.md](ISSUE-004-include-planner-silent-skip.md) |
| ISSUE-005 ✅ | Medium | Type System | `resolveTargetCtor()` accepts any function as a constructor | [ISSUE-005-resolve-target-ctor-unsafe-cast.md](ISSUE-005-resolve-target-ctor-unsafe-cast.md) |
| ISSUE-006 | Medium | Public API, Clean Architecture | Internal services exported from `@ts-linq/orm` and `@ts-linq/query` public APIs | [ISSUE-006-orm-internals-public-export.md](ISSUE-006-orm-internals-public-export.md) |
| ISSUE-007 ✅ | Medium | Type System, Public API | Lambda-selector signatures erase `keyof T` and produce false inference | [ISSUE-007-lambda-selector-type-erasure.md](ISSUE-007-lambda-selector-type-erasure.md) |
| ISSUE-008 | Medium | SOLID, Maintainability | `LazyLoadingProxy` and `BatchOperations` are new god modules in `@ts-linq/core` | [ISSUE-008-core-runtime-bloat-lazy-loading-proxy.md](ISSUE-008-core-runtime-bloat-lazy-loading-proxy.md) |
| ISSUE-009 | Low | Clean Code, Maintainability | `Queryable` is still 942 LOC after audit v4's decomposition | [ISSUE-009-queryable-still-942-loc.md](ISSUE-009-queryable-still-942-loc.md) |
| ISSUE-010 | Low | Documentation Drift, Maintainability | `@ts-linq/integration-nestjs` is still an unimplemented placeholder (carry-over from v4 ISSUE-019) | [ISSUE-010-integration-nestjs-still-placeholder.md](ISSUE-010-integration-nestjs-still-placeholder.md) |
| ISSUE-011 ✅ | Low | Clean Code, Testability | `DbContext` constructor silently swallows configuration errors | [ISSUE-011-soft-delete-silent-catch.md](ISSUE-011-soft-delete-silent-catch.md) |

---

## Severity Summary

| Severity | Count | Resolved |
|----------|-------|----------|
| Critical | 0 | — |
| High | 3 | 2 (ISSUE-001, ISSUE-002) |
| Medium | 5 | 3 (ISSUE-004, ISSUE-005, ISSUE-007) |
| Low | 3 | 1 (ISSUE-011) |
| **Total** | **11** | **6** |

---

## Top Architectural Risks

### 1. Proxy-based DSL has erased type safety in the new query API (ISSUE-001 + ISSUE-002 + ISSUE-007)

PR #66 introduced three load-bearing uses of `Proxy`:
- `DbContext` constructor **returns** a Proxy (cast `as unknown as this`) to implement
  "`new DbSet(Entity)` property initializers";
- `extractKey()` uses a Proxy to convert lambda selectors to property-name strings;
- The selector union `K | ((entity: T) => unknown)` advertises lambda support at the type level.

Together these create a query DSL where the type system **cannot verify** that a selector points at
a real property, the Proxy **silently** accepts arbitrary access, and only the *first* property
access ever survives — so `u => u.profile.city` becomes `"profile"` with no warning. Users writing
EF-Core-style chains believe they have compile-time safety; they do not.

This is the most important systemic risk because it sits on the user's hottest path (every query)
and silently produces wrong results without any signal at compile, lint, test, or runtime.

### 2. Public API surface drift (ISSUE-003 + ISSUE-006)

Audit v4 decomposed `DbContext`/`Queryable`/`DbSet`/`EnhancedSqlCache` into focused collaborators
(`CacheCoordinator`, `AuditInterceptor`, `FallbackManager`, `PaginationBuilder`,
`SoftDeleteInterceptor`, `ChangeValidationService`, …). Two things then happened:

- All collaborators were re-exported from package barrels (`packages/orm/src/index.ts`,
  `packages/query/src/index.ts`) without an `@internal` discipline, freezing implementation
  details as public contract.
- `DbSet` re-grew to 53 public methods (515 LOC) by hand-forwarding the entire `Queryable` surface,
  reversing the v4 ISSUE-017 fix.

The decomposition reduced individual class size but expanded the API surface and re-created the god
class one layer up. Without a structural `@internal` boundary and an interface-based `DbSet`,
every future decomposition will repeat this pattern.

### 3. `@ts-linq/core` runtime is the next god-class location (ISSUE-008 + ISSUE-009)

Audit v4 caught god classes in the ORM and query layers but did not survey `@ts-linq/core`. Two
files there now dominate the package:

- `LazyLoadingProxy.ts` — 752 LOC, mixes Proxy traps, request coalescing, metrics, and policy.
- `BatchOperations.ts` — 580 LOC, mixes four CRUD operations sharing batched state.

These are 33% of the `core` package by LOC. `Queryable.ts` (942 LOC) is the same problem one layer
up. None of the three are caught by the current arch tools — file size and per-class method count
are not measured. CI needs a check.

### 4. Silent failure modes block correctness signals (ISSUE-004 + ISSUE-005 + ISSUE-011)

Three independent places swallow errors silently:

- `IncludePlanner.loadLevel` continues past unknown navigation properties.
- `resolveTargetCtor` `try/catch`-swallows forward-ref factory errors.
- `DbContext` constructor wraps three provider-configuration calls in empty `try/catch {}`.

Combined effect: a typo or misconfiguration in include paths, lazy entity factories, or soft-delete
options produces a `DbContext` that constructs successfully, builds queries successfully, executes
queries successfully, and returns incomplete or wrong data. No log, no telemetry, no test signal.

This pattern is **architectural**, not stylistic — silent catches make the system untestable.

---

## Recommended Refactoring Order

Issues are ordered to unblock correctness first, then encode invariants in the type system, then
decompose. Each later phase relies on the discipline introduced in earlier phases.

### Phase 1 — Restore correctness signals (Week 1)

1. **ISSUE-011** — Remove silent `try/catch {}` in `DbContext` constructor; encode optional
   provider capabilities at the type level. (Smallest change, highest ROI.)
2. **ISSUE-004** — Make `IncludePlanner` throw on unknown navigation properties.
3. **ISSUE-005** — Move forward-ref resolution into `@ts-linq/metadata`; validate constructibility.

After Phase 1, configuration errors and typos surface synchronously and the rest of the audit
becomes testable.

### Phase 2 — Stop the type-system bleed (Weeks 2–3)

4. **ISSUE-002** — Either restrict `extractKey` to single-property lambdas (throw on nested), or
   implement full nested-path support and validate via metadata.
5. **ISSUE-007** — Tighten lambda selector return types (`T[keyof T]`); introduce
   `OrderedQueryable<T>` so `thenBy` only chains after `orderBy`.
6. **ISSUE-001** — Replace the Proxy-from-constructor pattern with an explicit injection mechanism
   (`defineSet()` helper or lazy `_injectContext`); remove the `as unknown as this` cast.

### Phase 3 — Decompose where decomposition is structural, not surface (Weeks 4–5)

7. **ISSUE-006** — Move all internal services under an `internal/` subfolder, strip from public
   barrels, enforce via `dependency-cruiser`.
8. **ISSUE-003** — Make `DbSet<T>` extend (or implement an interface over) `Queryable<T>` — remove
   the 28+ hand-forwarded methods.
9. **ISSUE-008** — Decompose `LazyLoadingProxy` and `BatchOperations`; add per-file LOC cap to CI.
10. **ISSUE-009** — Extract `extractKey` and `JoinBuilder` from `Queryable.ts`; cap at 600 LOC.

### Phase 4 — Close v4 carry-over (background)

11. **ISSUE-010** — Decide between implementing or removing `@ts-linq/integration-nestjs`.

---

## Notes

- **Mechanical tools are clean.** `arch:cycles`, `arch:deps`, `arch:dead`, and `typecheck` all
  pass with zero findings on the current `main` (`3cb800ed`). Every issue in this audit is a
  **semantic** structural problem that those tools cannot detect.
- **ISSUE-010 is a carry-over** of audit v4 ISSUE-019 ("`@ts-linq/integration-nestjs` is an
  unimplemented placeholder") — re-numbered because it is the only v4 finding still open.
- **No findings for**:
  - `@ts-linq/dialect-postgres / mysql / mssql` — small, focused, correct.
  - `@ts-linq/provider-*` — same.
  - `@ts-linq/sql-visitor` — implementation completed after ISSUE-005 v4; 412 LOC, focused.
  - `@ts-linq/ast` — 249 LOC, no SQL leakage post-ISSUE-006 v4.
  - `@ts-linq/migrations` — circular dependency closed in ISSUE-021 v4; well-distributed (28 files).
  - `@ts-linq/transformer` — `expression.ts` is large (459 LOC) but compile-time-only and tightly
    scoped; included here as a watch-list item, not an issue.
  - `@ts-linq/typescript-config / eslint-config / jest-config` (new in TASK-001 of v4) — clean.
- **Assumption**: The Proxy-based `extractKey` is intentional (not an oversight) — confirmed by
  PR #66 commit message advertising lambda support as a feature. Recommendations in ISSUE-002 /
  ISSUE-007 therefore propose two replacement paths; the project may legitimately prefer either.
- **Human review needed** for ISSUE-001: returning a Proxy from a constructor is unusual enough
  that any redesign should be reviewed by someone familiar with the multi-level `DbContext`
  subclass scenarios users have in production.
