# dialect-postgres/task-10 — Converge the migrations DDL generator onto the shared `DdlStrategy`

Status: ✅ completed. Branch `audit-refactor/dialect-migrations-ddl-convergence`.
Cross-boundary half of task-7 (which unified the DDL strategies *inside* the dialect packages).

## Problem

`@ts-linq/migrations` ran a **second, independent DDL generator** (`builders/SqlUtils.ts` +
`builders/handlers/ColumnHandlers.ts`) with its own `mapType`, quoting and inline-COMMENT logic —
the exact drift class task-7 removed, still alive across the migrations↔dialect boundary.

## Composition root (the hard part)

There was **no** dialect-name → strategy factory anywhere in the repo: `dialect-*` were only
`devDependencies` of migrations, and neither `cli` nor `orm` depends on a dialect. Resolution:

- `dialect-{postgres,mysql,mssql}` promoted `devDependencies → dependencies` of `@ts-linq/migrations`
  (+ tsconfig `references`). Graph stays acyclic (`arch:cycles` clean); no dependency-cruiser rule
  covers `migrations → dialect-*`.
- New `src/builders/ddl/DdlStrategyFactory.ts` — `createDdlStrategy(dialect)`, **memoized per
  dialect** (strategies are stateless once `logger` is fixed to `undefined`), mirroring the sibling
  `QuoterFactory`. This is the ONLY place migrations may import a concrete dialect.
- Everything downstream depends on the `DdlStrategy` **contract** from `@ts-linq/types`.
- Public `generateMigrationFromDiff(diff, dialect)` signature unchanged.

## Contract / dialect-kit changes

- `@ts-linq/types` (**minor**): `DdlStrategy` gained `generatePrimaryKeyClause(metadata)` — was
  `protected buildPrimaryKeyClause` in `AbstractDdlStrategy`, promoted so a caller owning its own
  CREATE TABLE wrapper can reuse key resolution + quoting.
- `@ts-linq/dialect-kit` (**minor**): `AbstractDdlStrategy` takes the `TypeMapper` via constructor
  (`constructor(logger, typeMapper)`) instead of an abstract field. ⚠️ The three concretes had to
  **drop their field initializer** — a subclass field initializer runs *after* `super()` and would
  silently overwrite the injected mapper.
- `dialect-{postgres,mysql,mssql}` (**minor**): ctor `(logger?, typeMapper = new XTypeMapper())`;
  `PostgresTypeMapper`/`MySqlTypeMapper`/`MssqlTypeMapper` now exported from each barrel.

## Two behaviour-preserving adapters (migrations side)

1. `SnapshotTypeMapper` (Decorator) — dialect mappers fall back to `TEXT`/`NVARCHAR(MAX)` for
   unknown types; migration snapshots may carry a hand-written physical type (`VARCHAR(255)`,
   `DECIMAL(10,2)`). Delegates only the ten historical logical types
   (`INTEGER|NUMBER|TEXT|STRING|BOOLEAN|DATETIME|DATE|REAL|FLOAT|DOUBLE` — the old `groupType`
   domain, verified byte-identical against all three mappers) and passes everything else through
   uppercased. **Deliberately narrower** than the dialect mappers: `BLOB`/`UUID`/`JSON`/`JSONB`
   would otherwise become `BYTEA`/`UNIQUEIDENTIFIER`/… and rewrite existing DDL.
2. `ColumnAdapter` — `ColumnDef`/`TableSnapshot` → `ColumnMetadata`/`EntityMetadata`. Resolves
   `defaultExpressionDialect` (added to `ColumnDef`; previously read via a cast) and **pre-renders
   literal defaults** through the audited migrations `SqlQuoter` into `defaultExpression`, so the
   strategy takes its expression branch. Reason: PG `SqlQuoter.literal(true)` → `TRUE`, whereas
   dialect-kit `formatValue(true)` → `1`, which is invalid on a PG BOOLEAN column. **That is a
   latent dialect-side bug and is exactly task-11's scope.** Never sets `isGenerated`/`length`
   (would add `GENERATED … IDENTITY` / `AUTO_INCREMENT` / `(len)`).

## Result: byte-identical, zero reconciliations

Golden captured from the pre-change generator over an exhaustive `SchemaDiff` and diffed after —
**0 differences** on all three dialects. Locked permanently by
`packages/migrations/tests-new/builders/ddl-convergence.golden.test.ts` (+ fixture in
`__fixtures__/ddl-convergence-fixture.ts`).

Deleted: `SqlUtils.mapType`, `SqlUtils.groupType`, `ColumnHandlers.renderColumn`/`buildAddColumnSql`/
`buildDropColumnSql`/`buildAlterTypeSql`/`renderCheckConstraint` (dead), and the per-dialect
switches in `UniqueConstraintsSqlBuilder`/`TableHandlers`.
Kept as **thin adapters** over the strategy (published surface preserved):
`buildAddUniqueConstraintSql`, `buildDropUniqueConstraintSql`, `buildCreateTableSql(td, dialect, ddl?)`.

## Coordination with migrations/task-3 (no competing quoting paths)

task-3 built the audited per-dialect `SqlQuoter`/`QuoterFactory` inside migrations; the dialect
`quoteIdentifier` from dialect-postgres/task-3 is **byte-identical** to it (PG `"`→`""`,
MySQL `` ` ``→``` `` ```, MSSQL `]`→`]]` — verified with adversarial identifiers in the golden
fixture). DDL paths owned by the strategy quote through the dialect; the paths still owned by
migrations (FK, indexes, CREATE TABLE wrapper, renames, seeds/DML) keep `SqlUtils.q`/`formatValue`,
which are thin facades over the same `SqlQuoter`. Unifying the remaining literal encoder is task-11;
injecting the quoter into `AbstractDdlStrategy` is task-12.

## Deliberately NOT converged (contract cannot express it without changing SQL)

CREATE TABLE wrapper (MSSQL `IF OBJECT_ID(N'…', N'U')` vs strategy's `sys.tables` lookup — different
text *and* schema semantics; MySQL would gain `COMMENT='…'`); FKs (`ForeignKeySpec` is
single-column, migrations supports composite); indexes (`PgIndexBuilder` emits `IF NOT EXISTS`, lacks
PG `INCLUDE`; `IndexHandlers` is the inverse); RENAME TABLE (MySQL `RENAME TABLE` vs base
`ALTER TABLE … RENAME TO`); RENAME COLUMN / ALTER NULL (not in the contract); seeds/DML.

## Residual debt

- `SnapshotTypeMapper` vocabulary is narrower than the dialect mappers' — reconcile explicitly.
- `handleCreateTable`'s inline `CREATE INDEX` loop (fresh-table path) discards nine `IndexDef`
  fields the `td.indexCreates` ALTER path honours — pre-existing asymmetry, now the last hand-rolled
  index emitter in that file.
- Plain `ADD COLUMN` drops the column comment while CREATE TABLE emits it — preserved verbatim.
- `import '@ts-linq/migrations'` now eagerly evaluates all three dialect barrels; fixable with
  subpath `exports` on the dialect packages.

## Validation (all green)

typecheck 34/34 · lint 0 errors · unit 412 suites/4207 · integration 88/461 · e2e 19/290 ·
build 34/34 · arch:deps + arch:cycles + arch:dead clean.

Related: [[refactor/dialect-postgres/task-7-shared-ddl-strategy]],
[[refactor/migrations/task-1-safe-quoting-layer]], [[refactor/migrations/task-3-safe-codegen]].
Feeds task-11 (formatValue SSOT) and task-12 (inject the DDL quoter).
