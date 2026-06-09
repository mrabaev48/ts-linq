# core/task-4 — RelationshipLoader junction SQL-injection fix (✅ DONE)

P0 security fix. Closed the SQL-injection vector in `RelationshipLoader` junction
(many-to-many) reads, which previously string-interpolated unquoted identifiers
(`through.table`, `sourceFk`, `targetFk`) into SQL.

## Chosen architecture — Option A (capability port)
- New provider capability **`DatabaseProvider.queryJunction(spec: JunctionQuerySpec)`**
  (`packages/core/src/DatabaseProvider.ts`), a **concrete** (non-abstract) method so all
  providers inherit a safe default — no provider override needed. Quoting differences come
  only from the dialect's `quoteIdentifier`.
- It validates every identifier against `JUNCTION_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/`
  (fails closed), quotes via `getDialect().quoteIdentifier`, binds all `whereValues` as `?`
  params, and short-circuits to `[]` when `whereValues` is empty.
- `RelationshipLoader.fetchJunctionMappings` / `fetchTargetIdsFromJunction` now call
  `provider.queryJunction(...)`. Result-row keys are the **column names** (no `s`/`t`/`id`
  aliases anymore).

## @ts-linq/types additions (minor)
- `JunctionQuerySpec` interface in `packages/types/src/sql.ts`
  (`table`, `selectColumns`, `whereColumn`, `whereValues: SqlParameter[]`).
- `InvalidIdentifierError` + `OrmErrorCode.InvalidIdentifier` (`'INVALID_IDENTIFIER'`) in
  `errors.ts`; added to the named re-export in `index.ts` and to the runtime-export allowlist
  in `tests/type-exports.test.ts`.

## Key facts
- `SqlDialect.quoteIdentifier` **already existed** (`packages/types/src/dialect.ts`) — not added.
  pg `"col"`, mysql `` `col` ``, mssql `[col]` (all escape internal quote chars).
- `core/src/loading` now emits **zero** SQL text (grep-confirmed).
- Changeset: `@ts-linq/types` minor, `@ts-linq/core` patch (per maintainer choice; providers no
  source change → no changeset).

## Tests
- `packages/core/tests-new/DatabaseProvider.queryJunction.test.ts` — quoting + parameterization +
  fail-closed (`InvalidIdentifierError`, code + `details.identifier`) for space/quote/`;`/`--`/`)`.
- `RelationshipLoader.test.ts` — many-to-many loadSingle/loadBatch route through `queryJunction`.
- Per-dialect: `provider-{postgres,mysql,mssql}/tests-new/queryJunction.test.ts` (capturing
  subclass overrides `doExecuteQuery`; real dialect) assert `"jt"` / `` `jt` `` / `[jt]`.

## Validation outcome (all green)
typecheck, lint (0 err), unit 3089, integration 464, e2e 290, build, arch:deps/cycles/dead.
Integration/e2e exercise real many-to-many loads across pg/mysql/mssql → end-to-end verified.

## Follow-ups / tech debt
- Option B (AST/RawSqlNode junction read) would move even the SELECT skeleton out of the base
  provider — deferred future improvement.
- Coordinate with `core/task-9` (barrel curation) if it rewrites junction methods.
- core package remains 🔄 in progress (tasks 2, 6, 5, 1, 3, 7, 8, 9 pending).
