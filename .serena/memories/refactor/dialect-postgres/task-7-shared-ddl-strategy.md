# dialect-postgres/task-7 — Shared DdlStrategy contract + AbstractDdlStrategy (✅ completed)

**Branch:** `audit-refactor/dialect-shared-ddl-strategy` (from `main` @ 2b0cd205). P1 / L / medium.
The DDL mirror of task-1 (`AbstractSqlDialect`). Note: **branched from main, NOT stacked on task-1**
(task-1 `d8b7a8fd` not yet merged); task-7 hard-depends only on task-3 quoting (on main). Both PRs
bump `dialect-kit` to 0.3.0 → whichever merges second needs a re-bump (known coordination cost).

## What landed
- **`@ts-linq/types`** (`src/dialect.ts`, minor 4.9.0→4.10.0): new `DdlStrategy` (11-method full DDL
  contract), `TypeMapper` (`mapType(logicalType, length?) => string`), `ForeignKeySpec`,
  `CreateIndexSpec`. Auto-exported via `export * from './dialect'`.
- **`@ts-linq/dialect-kit`** (minor 0.2.1→0.3.0):
  - `src/ddl/AbstractDdlStrategy.ts` — `abstract class AbstractDdlStrategy implements DdlStrategy`
    (Template Method). Owns invariant algorithms: generateCreateTableSql skeleton (validate→map
    cols→PK→checks→`wrapCreateTable` hook), buildPrimaryKeyClause, buildCheckConstraints,
    generateColumnDefinition dispatch (computed→`renderComputedColumn`, scalar→`renderScalarColumn`),
    `renderDefault` (shared DEFAULT/formatValue), generateForeignKeySql + generateDropColumnSql
    (byte-identical all 3), generateAddColumnSql (`{addColumnClause} + generateColumnDefinition`),
    generateAlterColumnTypeSql (+`renderAlterColumnType` hook), generateRenameTableSql (PG/MySQL
    default; MSSQL overrides), generateAddUniqueConstraintSql (PG/MSSQL default; MySQL overrides),
    generateDropUniqueConstraintSql (+`renderDropUniqueConstraint` hook), generateCommentSql (shared
    loop + `renderTableComment`/`renderColumnComment` default-'' hooks). `quoteIdentifier`/
    `quoteStringLiteral` are abstract protected → each concrete delegates to its task-3 `quoting.ts`.
    Typed `MetadataError` (not `new Error`) for the invalid-metadata guard (msg preserved for the
    `/invalid or missing columns/` regex test).
  - `src/params/format-value.ts` — `formatValue` relocated verbatim from `@ts-linq/core`'s
    `SqlHelper.formatValue`. Removes the **dialect→core** DDL edge (arch:deps clean). Core's
    `SqlHelper.formatValue` kept as-is (no core break; full removal deferred to task-8).
  - Both exported from `dialect-kit/src/index.ts` (+ `DdlLoggerLike`).
- **Concrete strategies** (patch 2.8.10→2.8.11): each `extends AbstractDdlStrategy implements
  DdlStrategy`, reduced to a per-dialect `TypeMapper` (new `PostgresTypeMapper`/`MssqlTypeMapper`/
  `MySqlTypeMapper`, internal, own the `mapType`+length; MSSQL `(MAX)`→`(len)`, MySQL append `(len)`,
  PG ignores length) + divergent hooks + `generateCreateIndexSql` (keeps rich per-dialect index
  param, delegates to its IndexBuilder). Public `mapTypeToPg/Mssql/MySql` retained as delegates
  (existing unit tests call them). Sizes: PG 104 / MSSQL 93 / MySQL 102 lines (were ~205/200/180).
  No more `SqlHelper`/core import in any DDL strategy.
- **`@ts-linq/core`** (patch 3.5.0→3.5.1): `src/DdlStrategy.ts` now re-exports the contract from
  `@ts-linq/types` (backward compatible; `DdlBuilder` + public surface unchanged). Fixed
  `DdlBuilder.test.ts` mock (had fictional method names; now mocks the real 11-method interface).

## COMMENT reconciliation (user decision: structural / byte-preserving)
Discovered `generateCommentSql` is **test-only** (no provider/migrations caller); in production
comments reach DDL only via MySQL inline (`COMMENT=` / column `COMMENT`); PG/MSSQL create-table emits
none. So uniform-separate would REGRESS MySQL. Chosen: shared skeleton is comment-free; MySQL's inline
comment is an **explicit documented hook** (`wrapCreateTable` table-level, `renderScalarColumn`
column-level); PG/MSSQL keep their `generateCommentSql`; MySQL inherits base → `[]`. **Zero golden
change** — all DDL byte-identical. (Separate parallel DDL generator in
`migrations/src/builders/handlers/ColumnHandlers.ts` is OUT of scope = tech debt.)

## Tests
- New `runDdlStrategyContract` harness in `@ts-linq/testkits` (`src/ddl-contract/`, mirrors task-6):
  shared case matrix (createTable/columnDefinition/createIndex/add-drop-alter col/rename/FK/
  add-drop-unique/comment) + per-dialect `tests-new/ddl-contract.golden.ts` (byte goldens) + a
  completeness guard. 96 contract tests green.
- Regression: 93 `*DdlStrategy` unit + 99 migrations-dialect integration all green unchanged.

## Validation (all green)
typecheck 33/33 · lint 0 errors · build 33/33 · arch:deps ✓ (dialect→core DDL edge gone) ·
arch:cycles ✓ (abstract never imports concretes) · arch:dead ✓ · **test:all: unit 4012 /
integration 461 (2 skip) / e2e 290 (real PG+MySQL+MSSQL)** all pass.

## Next
`dialect-postgres` stays 🔄 In Progress. Remaining: task-2 (capability model), task-8 (dead exports/
options + finish dialect→core/metadata decoupling, incl. full `formatValue` removal from core).
