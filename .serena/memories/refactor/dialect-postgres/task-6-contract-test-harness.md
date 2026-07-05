# dialect-postgres/task-6 — Shared SqlDialect contract-test harness ✅ completed

**Status:** completed (branch `audit-refactor/dialect-contract-test-harness`).

## What was built
`runSqlDialectContract(makeDialect, golden)` lives in **`@ts-linq/testkits`**
(`packages/testkits/src/dialect-contract/`), exported from the testkits barrel:
- `goldenTypes.ts` — `SqlDialectContractGolden` (typed per-method golden maps: parameterLimit,
  select/insert/update/delete/bulkUpdate/bulkDelete/batchInsert/batchUpdate/batchDelete).
- `fixtures.ts` — shared `ContractEntity` (+ `registerContractEntity`/`clearContractEntity` around
  the global `MetadataStorage`, required because `buildSelect` resolves the table via it) and
  `EntityMetadata` fixtures (computed-col, concurrency token, rowversion, non-generated PK).
- `cases.ts` — the shared **input matrix** (SELECT star/columns/distinct/where/join/order/group/
  group-empty/limit-offset/combined; INSERT basic/computed-col/supplied-pk; UPDATE no-token/
  nonversion-token/version; DELETE no-token/token; BULK update/delete; BATCH insert×3/update/delete).
  Optional dialect methods invoked as `d.buildX!(...)` (method-call preserves `this`).
- `runSqlDialectContract.ts` — golden-master runner: per-case `toEqual(golden[group][id])`,
  a **completeness guard** (golden keys must equal declared case ids), a `parameterLimit` check, and
  uniform (non-golden) throw-contract assertions (`/empty entity list/i`, `/no primary key/i`).

Each dialect package runs it from `tests-new/dialect-contract.test.ts` with a per-dialect
`tests-new/dialect-contract.golden.ts` (data captured from current behaviour).

## Consolidation
Deleted the 6 copy-paste tests: `dialect-*/tests-new/*BatchSyntax.test.ts` and
`dialect-*/tests-new/build-update-concurrency.test.ts`. Kept `tests-new/dialect/*Dialect.test.ts`
and `*DdlStrategy.test.ts` as extra regression.

## Captured divergences (documented, NOT fixed here — targets for task-1..task-5)
- **GROUP BY empty columns:** MSSQL guards it out (no clause); PG/MySQL emit a bare ` GROUP BY `.
- **computed-col INSERT:** MySQL/PG exclude `isComputed`; MSSQL includes it (latent bug, captured).
- **batch UPDATE shape:** PG (CTE) / MSSQL (VALUES JOIN) return single `sql`; MySQL returns
  per-row `statements[]`.
- **batch INSERT PK writeback:** PG `RETURNING *`, MSSQL `OUTPUT INSERTED` (omitted when PK not
  generated), MySQL `returnsRows:false` + `fetchFirstInsertIdSql = SELECT LAST_INSERT_ID()`.
- **paging:** MSSQL uses OFFSET/FETCH (+ synthesised `ORDER BY (SELECT NULL)`); PG/MySQL LIMIT/OFFSET.
- parameterLimit: PG 65535, MySQL 65535, MSSQL 2100.

## Mutation check (verified once, reverted)
Removing the `columns.length > 0` guard in `dialect-mssql/src/emitters/MssqlGroupEmitter.ts` made the
MSSQL `select/group-empty` case fail the contract → proves the net catches regressions. Reverted.

## Boundaries / why testkits
Harness depends only on `@ts-linq/types` + `@ts-linq/metadata` (never on a sibling dialect), so no
dialect→dialect edge. Dialect test files (in `tests-new/`, outside `src/`) import testkits; jest
resolves `@ts-linq/testkits`→`src` via moduleNameMapper (no build needed). Ambient jest globals used
in testkits src (no `@jest/globals` import), matching `SqlSnapshotMatcher.ts`. `arch:cycles` clean.

## Validation (all green)
typecheck 32/32; lint 0 errors; unit 375 suites/3852; integration 88/461; e2e 19/290; build 32/32;
arch:deps + arch:cycles + arch:dead clean.

## Changeset
None — `@ts-linq/testkits` is `private:true`/unpublished; only test files + testkits src + docs
changed (no versioned package source). CI "Version bump present" not triggered.

## Next
`dialect-postgres` stays 🔄 In Progress. This harness is the safety net for the dedup tasks; next
recommended is `dialect-postgres/task-3` (centralize identifier quoting, P0).
