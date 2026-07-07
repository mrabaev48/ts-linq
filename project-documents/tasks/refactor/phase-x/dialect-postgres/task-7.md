---
status: completed
phase: phase-x
package: dialect-postgres
priority: P1
effort: L
risk: medium
category: architecture
depends_on: ['dialect-postgres/task-3.md']
related: ['dialect-mssql/task-1.md', 'dialect-mysql/task-1.md']
---

# Refactor: Define a shared DdlStrategy contract and extract the duplicated type-mapping + column-definition logic

## Problem
The three DDL strategy classes (`PostgresDdlStrategy`, `MssqlDdlStrategy`, `MySqlDdlStrategy`) have the same
public method shape but **no shared interface** — they are structurally-typed by accident. Each re-implements
the same algorithm (build column defs → append PK → append check constraints → wrap in CREATE TABLE) and its
own `mapTypeTo*` switch, `generateColumnDefinition`, FK/constraint/comment emitters, with inline quoting and
no abstraction. There is no `DdlStrategy` type in `@ts-linq/types`, so consumers cannot depend on the contract.

## Evidence
- No shared interface; parallel classes:
  - `packages/dialect-postgres/src/PostgresDdlStrategy.ts:6` `class PostgresDdlStrategy` (no `implements`).
  - `packages/dialect-mssql/src/MssqlDdlStrategy.ts:7` `class MssqlDdlStrategy` (no `implements`).
  - `packages/dialect-mysql/src/MySqlDdlStrategy.ts:8` `class MySqlDdlStrategy` (no `implements`).
- `generateCreateTableSql` is the same algorithm in all three: map columns → PK → check constraints → wrap
  (`PostgresDdlStrategy.ts:12`, `MssqlDdlStrategy.ts:12`, `MySqlDdlStrategy.ts:13`).
- Per-dialect `mapType*` switch/map with overlapping keys: `MssqlDdlStrategy.ts:169`,
  `MySqlDdlStrategy.ts:146`, `PostgresDdlStrategy.ts:178`.
- `generateForeignKeySql`, `generateAddUniqueConstraintSql`, `generateDropUniqueConstraintSql`,
  `generateCommentSql` are near-identical modulo quote char (`*DdlStrategy.ts` FK at `:106/:78/:115`).
- Inline quoting throughout instead of `quoteIdentifier` (`MssqlDdlStrategy.ts:22,31,54`, etc.) — see `task-3`.
- `generateColumnDefinition` ordering diverges: MySQL appends `COMMENT` inline (`MySqlDdlStrategy.ts:140`);
  MSSQL/PG do not — another copy-paste drift.

## Why this is bad
- No `DdlStrategy` contract means migrations/scaffolding code relies on duck typing; a missing method is a
  runtime error, not a compile error (Dependency Inversion violation).
- Triplicated algorithm + type maps drift (the COMMENT-in-coldef divergence is proof) and triple the cost of
  supporting a new column attribute.
- Inline quoting duplicates `task-3`'s safety gap into the DDL surface.

## Target architecture
Apply **Template Method + Strategy + Interface Segregation**:
- Define `DdlStrategy` in `@ts-linq/types` (the contract migrations depend on).
- Introduce `AbstractDdlStrategy` (shared package) owning the invariant CREATE TABLE / ALTER / FK / constraint /
  comment algorithms, parameterized by:
  - a `TypeMapper` strategy (`mapType(logicalType, length?) => string`),
  - the injected `quoteIdentifier`/`quoteStringLiteral` (from `task-3`),
  - small hooks for genuinely divergent fragments (MSSQL `IF NOT EXISTS sys.tables`, identity syntax,
    PG `GENERATED ... STORED`, MySQL `AUTO_INCREMENT`/table-level `COMMENT=`).
- Concrete strategies supply only the `TypeMapper` and the divergent hooks.

## Proposed refactor
1. Add `DdlStrategy` interface + `TypeMapper` interface to `@ts-linq/types`.
2. Build `AbstractDdlStrategy` with the shared algorithms; route all quoting through `task-3` helpers.
3. Reduce each concrete strategy to a `TypeMapper` + divergent hooks; reconcile the COMMENT-in-coldef divergence.
4. Have migrations/scaffolding depend on `DdlStrategy`, not concrete classes.

## Suggested design patterns
- **Template Method** for the CREATE/ALTER skeletons. WHY: the algorithm is invariant; only tokens/type maps vary.
- **Strategy (`TypeMapper`)** for logical→physical type mapping. WHY: isolates the one genuinely per-dialect table.
- **Interface Segregation** via a `DdlStrategy` contract. WHY: compile-time guarantees for migration consumers.

## Testing plan
- Contract: a `runDdlStrategyContract` matrix (mirrors `task-6`) over CREATE/ALTER/FK/unique/comment for all three.
- Unit: each `TypeMapper` table-driven (all logical types → expected physical type).
- Regression: keep `*DdlStrategy.test.ts` green; snapshot DDL output before/after.

## Acceptance criteria
- [ ] `DdlStrategy` + `TypeMapper` interfaces in `@ts-linq/types`; concrete strategies `implements DdlStrategy`.
- [ ] `AbstractDdlStrategy` owns the shared algorithm; concrete files reduced to type map + hooks.
- [ ] COMMENT-in-coldef divergence reconciled and documented.
- [ ] All quoting routed through `task-3` helpers.
- [ ] `pnpm typecheck`, `pnpm tests:unit`, `pnpm build`, `arch:cycles`, `arch:dead` pass.

## Refactor order
1. Land `task-3` (quoting) first. 2. Add interfaces. 3. Extract abstract + type mappers. 4. Migrate consumers. 5. Contract tests.

## Notes
`*DdlStrategy` classes import `SqlHelper` from `@ts-linq/core` (`MssqlDdlStrategy.ts:1`) — a dialect→core
dependency-direction smell; see `task-9`. The `formatValue` utility should move to the shared dialect kit, not core.
