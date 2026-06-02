---
status: not-started
phase: phase-x
package: dialect-postgres
priority: P1
effort: XL
risk: high
category: architecture
depends_on: []
related: ['dialect-postgres/task-9.md', 'dialect-postgres/task-4.md', 'dialect-postgres/task-6.md', 'dialect-mssql/task-1.md', 'dialect-mysql/task-1.md']
---

# Refactor: Introduce a shared base SQL dialect (Template Method + injected DialectSyntax) to eliminate cross-dialect DML/SELECT duplication

## Problem
`PostgresDialect`, `MssqlDialect`, and `MysqlDialect` are ~85% identical re-implementations of the same
SQL-assembly algorithms (`buildSelect`, `buildInsert`, `buildUpdate`, `buildDelete`, `buildBulkUpdate`,
`buildBulkDelete`). They differ on exactly three axes: identifier quoting, parameter marker style, and
LIMIT/OFFSET syntax. There is no base class, no shared builder, and no template method — every change must be
hand-replicated three times. This is the single largest structural defect in cluster C5.

## Evidence
- `buildSelect` skeleton is identical across the three: head → select-params → FROM → join → where → group →
  order → limit/offset (`packages/dialect-postgres/src/PostgresDialect.ts:81`,
  `packages/dialect-mssql/src/MssqlDialect.ts:79`, `packages/dialect-mysql/src/MysqlDialect.ts:77`).
- `buildUpdate` version-column + concurrency-token + PK-WHERE logic is identical modulo quoting/markers:
  `packages/dialect-postgres/src/PostgresDialect.ts:217`, `packages/dialect-mssql/src/MssqlDialect.ts:174`,
  `packages/dialect-mysql/src/MysqlDialect.ts:146`.
- `buildDelete`: `PostgresDialect.ts:271`, `MssqlDialect.ts:232`, `MysqlDialect.ts:187`.
- `buildBulkUpdate`/`buildBulkDelete`: `PostgresDialect.ts:298/324`, `MssqlDialect.ts:261/287`,
  `MysqlDialect.ts:212/237` — identical loops differing only by quote char and `numberPlaceholders`.
- Helpers replicated everywhere: `buildSelectHead`, `collectSelectParams`, `buildLimitOffset`,
  `numberPlaceholders` (`PostgresDialect.ts:111-192`, `MysqlDialect.ts:104-130`, `MssqlDialect.ts:107-138`).

## Why this is bad
- DRY violation at the SQL-generation core, where a single missed edit silently emits incorrect dialect SQL.
- Open/Closed violation: a new clause means editing three abstraction-free classes.
- Single Responsibility violation: each class mixes orchestration, dialect policy, value coercion, and
  metadata lookup.
- Already drifting from copy-paste: MSSQL's insertable-column filter diverges from PG/MySQL (see `task-4.md`
  and `dialect-mssql/task-3.md`), PG carries dead duplicate clause methods (see `task-9.md`).

## Target architecture
Apply **Template Method** + **Strategy** + composition-first under Clean Architecture / Dependency Inversion:
- `AbstractSqlDialect implements SqlDialect` owns the invariant clause-ordering and parameter-collection
  algorithms, hosted in a shared package (`@ts-linq/dialect-kit` preferred, or inside `@ts-linq/sql-visitor`
  which all three already depend on).
- A `DialectSyntax` strategy supplies the only variable tokens: `quote(id)`, `renderParameterMarker(i)` /
  placeholder renumbering, `renderLimitOffset(opts, hasOrderBy)`, `renderSelectHead(opts)`.
- Concrete dialects shrink to a `DialectSyntax` plus genuinely divergent hooks (`renderReturning`,
  MSSQL `OUTPUT INSERTED` / `TOP`, PG `RETURNING *` / CTE, MySQL `LAST_INSERT_ID`).
- The algorithm depends inward on `DialectSyntax`; concrete dialects depend on the abstraction.

## Proposed refactor
1. Create the shared base + `DialectSyntax` interface.
2. Move invariant `buildSelect`/`build{Insert,Update,Delete}`/`buildBulk*` into the base parameterized by syntax + protected hooks.
3. Reduce each concrete dialect to syntax wiring + 2-3 divergent hooks (target < 120 lines each).
4. Preserve exported class names and `SqlDialect` shape — no consumer-facing break.

## Suggested design patterns
- **Template Method** — clause order is the invariant; only quoting/markers/limit vary. WHY: textbook fit, removes 3× duplication with no runtime branching.
- **Strategy** (`DialectSyntax`) — encapsulates the three variation axes as injectable policy. WHY: composition for the parts that truly differ; isolated testability.
- **Dependency Inversion** — base depends on `DialectSyntax`. WHY: enables the contract harness (`task-6.md`) to drive the base with a fake syntax.

## Testing plan
- Unit: base algorithm against a fake `DialectSyntax` (assert clause order + param ordering: SELECT params before FROM params).
- Contract: run `task-6.md` suite across all three concrete dialects.
- Regression: keep existing `*Dialect.test.ts` / `*BatchSyntax.test.ts` green.
- Snapshot: byte-equality of representative SELECT/INSERT/UPDATE/DELETE before/after.

## Acceptance criteria
- [ ] `AbstractSqlDialect` + `DialectSyntax` in a shared package consumed by all three dialects.
- [ ] Each concrete dialect file reduced to syntax wiring + divergent hooks (< 120 lines).
- [ ] No SQL output change for existing tests.
- [ ] `pnpm typecheck`, `pnpm tests:unit`, `pnpm build`, `pnpm arch:cycles`, `pnpm arch:dead` pass.
- [ ] No new circular dependency (shared base must not import concrete dialects).

## Refactor order
1. Land `task-9.md` (delete PG dead code + shared emitters) and `task-4.md` (reconcile insertable filter) first.
2. Introduce shared package + `DialectSyntax`; migrate SELECT for all three; verify.
3. Migrate INSERT/UPDATE/DELETE, then bulk operations.
4. Land `task-6.md` (contract tests) to lock behavior.

## Notes
`@ts-linq/sql-visitor` is already a shared dep of all three dialects, so the base can live there without a new
package boundary; a dedicated `@ts-linq/dialect-kit` keeps the surface narrower. Decide during design.
