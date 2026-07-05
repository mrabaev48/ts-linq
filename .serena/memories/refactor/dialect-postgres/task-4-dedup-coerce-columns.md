# dialect-postgres / task-4 — dedup coerce/columns/placeholders → dialect-kit ✅

**Status:** completed. Branch `audit-refactor/dialect-dedup-coerce-columns` off main.

## What changed
Extracted the duplicated parameter/column logic into `@ts-linq/dialect-kit` (the task-9 shared home)
as pure, dialect-agnostic SSOT utilities; deleted all local copies in the 3 dialect classes and their
`batch-syntax` modules.

New exports in `@ts-linq/dialect-kit`:
- `src/params/coerce.ts`: `coerceSqlParameter(value): SqlParameter`, `applyConverter(value, col)`.
- `src/params/placeholders.ts`: `numberPlaceholders(sql, prefix)` — `?`→`${prefix}${n}`; PG passes
  `'$'`, MSSQL passes `'@p'`, MySQL keeps `?` (doesn't call it). Collapses the former PG-private
  `$N` method + 2 MSSQL `@pN` copies into one.
- `src/columns/select-columns.ts`: `selectInsertableColumns(metadata, entity, options)` +
  `InsertableColumnOptions { excludeComputed, excludeGeneratedPk }`; `selectUpdatableColumns(metadata)`
  (excludes pk + generated + computed).

Deleted: 6 coerce copies (`coerceParameter`×3 classes + `coerce`×3 batch), 3 `applyConverter`,
3 `numberPlaceholders`-style copies, `insertableCols`×3 + inline setCols filters.

## Policy decision (user-confirmed: single SSOT policy)
All three dialects pass `{ excludeComputed: true, excludeGeneratedPk: true }` (module-level const
`PG_/MYSQL_/MSSQL_INSERT_POLICY` in each dialect class + its batch-syntax). Flags remain explicit
inputs (Policy object / Parameterize-from-above) so a future dialect can differ.

## Reconciled behavioural changes (all intended, more-correct)
1. **MSSQL INSERT now excludes computed columns** (was a latent bug; MSSQL CLAUDE.md required it).
   Only golden updated: `dialect-mssql/tests-new/dialect-contract.golden.ts` `insert.computed-col` →
   `INSERT INTO [users] ([name]) OUTPUT INSERTED.[id] AS id VALUES (@p1)`, params `['Alice']`.
   MySQL/PG goldens already excluded computed — unchanged.
2. MSSQL UPDATE now excludes computed (via `selectUpdatableColumns`) — no contract case, no golden change.
3. `excludeGeneratedPk` heuristic (skip unset non-generated PK) now uniform (MySQL single-row +
   MSSQL single/batch gained it) — no golden coverage; harmless for generated PKs.
4. `hasValue` unified to `!== null && !== undefined` (MySQL/MSSQL single-row were `!== undefined`) —
   only affects explicit-null generated column → now excluded.

Batch INSERT still does NOT apply value converters (pre-existing; out of scope, preserved).

## Tests
New `packages/dialect-kit/tests-new/`: `coerce.test.ts`, `select-columns.test.ts`, `placeholders.test.ts`.
Contract harness (task-6) green with the MSSQL golden update.

## Validation (all green)
typecheck ✔, lint ✔ (0 errors), build ✔, unit 3901 ✔, integration 461 ✔ (real pg/mysql/mssql),
e2e 290 ✔, arch:deps ✔, arch:cycles ✔ (dialect-kit adds no cycle), arch:dead clean.
NOTE: dialect-* typecheck against dialect-kit's built `dist` — must `pnpm --filter @ts-linq/dialect-kit
build` before typechecking dialects after editing dialect-kit's public surface.

## Changeset
`dialect-postgres`/`dialect-mysql`/`dialect-mssql` → patch (dedup + MSSQL computed-INSERT fix);
`dialect-kit` → minor (new exported utilities).

## Follow-ups / tech debt
- task-5: the coercion circular-ref `catch { String(value) }` fallback → typed error inside
  `dialect-kit/src/params/coerce.ts` (same shared module).
- `packages/query/src/SetPropertyCalls.ts::coerceToSqlParameter` is a separate near-duplicate (query
  package) — candidate future consolidation, out of this task's scope.
- Sibling cross-link: `dialect-mssql/task-3`.
