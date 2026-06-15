# refactor migrations/task-2 — decompose MigrationRunner

✅ DONE — **migrations' 3RD refactor task** (P0/L/high-risk). Branch
`audit-refactor/migrations-decompose-runner`. migrations stays 🔄 In Progress (tasks 3, 5–7 pending).

## What changed
New collaborators under `packages/migrations/src/runner/`:
- **`MigrationsTableSchema.ts`** — single source of truth: `MIGRATIONS_TABLE = '__migrations'` +
  `buildEnsureMigrationsTableSql(dialect)` (canonical CREATE-TABLE DDL; mssql IF-NOT-EXISTS/BEGIN/END,
  pg/mysql `CREATE TABLE IF NOT EXISTS`). Consumed by BOTH the store and the idempotent emitter →
  drift eliminated.
- **`MigrationHistoryStore.ts`** — Repository port: `ensureExists/list/record/remove`. Owns
  `MigrationRecord` interface (moved here from MigrationRunner; runner re-exports it for back-compat,
  avoids a type cycle).
- **`DefaultMigrationHistoryStore.ts`** — provider-backed impl. ctor `(provider, dialect =
  provider.providerLabel as Dialect)`. **No interpolated user data**: only the fixed `__migrations`
  constant + `?`-bound values (so task-1 SqlQuoter NOT needed here). `list()` does an **existence
  probe** (`SELECT COUNT(*) ... FROM information_schema.tables WHERE table_name = '__migrations'`) →
  returns `[]` ONLY when table genuinely absent; **no catch** so a query error on an existing table
  propagates (kills the silent-swallow data-corruption bug).
- **`MigrationLogger.ts`** — Logger port (info/warn/error, mirrors CLI `ports/Logger`) + exported
  `NO_OP_LOGGER` default → no `console` in the library.
- **`TransactionScope.ts`** — `run<T>(fn)` begins→runs→commits; on body throw rolls back + rethrows
  ORIGINAL; if rollback ALSO throws, attaches it to `error.suppressed[]` (manual — TC39
  `SuppressedError` not in lib target). Depends only on `Pick<DatabaseProvider,
  'beginTransaction'|'commitTransaction'|'rollbackTransaction'>` (`TransactionCapableProvider`).
- **`MigrationRunner.ts` rewritten** as thin orchestrator: `constructor(provider, options?:
  MigrationRunnerOptions={historyStore?,transactionScope?,logger?})`. Defaults built from provider →
  `new MigrationRunner(provider)` unchanged. Public API byte-identical (`addMigration`,
  `ensureMigrationTableExists`, `getAppliedMigrations`, `migrate`, `rollback`). migrate/rollback wrap
  failures in `MigrationApplyError.from`/`MigrationRollbackError.from(version,name,error)` (task-4,
  preserves cause + details{version,name}).
- **`idempotent-emitter.ts`** — `pg/mssql/mysqlEnsureTable` now call
  `buildEnsureMigrationsTableSql(dialect).trim()` (+ comment header + `;` for pg/mysql). Consolidation
  dropped redundant `NOT NULL` on mysql PK column (functionally identical; emitter tests use
  `toContain`).
- **`index.ts`** — public exports (per user decision → MINOR): `DefaultMigrationHistoryStore`,
  `MigrationHistoryStore`(type), `MigrationLogger`(type), `NO_OP_LOGGER`, `MIGRATIONS_TABLE`,
  `buildEnsureMigrationsTableSql`, `TransactionScope`, `TransactionCapableProvider`(type).
  `MigrationRunnerOptions`/`MigrationRecord` flow through `export * from './MigrationRunner'`.

## GOTCHA — placeholder normalization is asymmetric
- `executeNonQuery` path runs `formatSqlWithParams` → normalizes `?`→`$n` (PG) / `@pn` (MSSQL);
  MySQL native. So `?` is fine for record/remove (verified by integration).
- **`executeQuery`'s `doExecuteQuery` does NOT normalize `?`** (PG passes sql straight to
  `pool.query`). My first probe used `?`+params → PG "syntax error at end of input" (4 e2e fails).
  Fix: probe embeds the `__migrations` literal directly (no placeholder) — safe, it's a constant.
  Lesson: never put `?` in an `executeQuery` call expecting normalization.

## Tests
- New `tests-new/runner/`: `TransactionScope.test.ts` (order/rollback/suppressed),
  `DefaultMigrationHistoryStore.test.ts` (absent→[]; existing+query-error→propagate; parameterized
  INSERT/DELETE), `MigrationHistoryStore.contract.test.ts` (`describe.each` shared suite over
  in-memory fake + provider-backed default), `MigrationRunner.runner.test.ts` (begin→up→record→commit
  order; up-fail→MigrationApplyError w/ cause; rollback-also-fails→suppressed; logger port; NO
  console).
- Updated regression `tests-new/MigrationRunner.test.ts`: mock provider gains `providerLabel:
  'postgresql'` + models the information_schema probe (`tableExists = tableCreated ||
  migrations.length>0`); the old `should handle database errors gracefully` (expected `[]`) rewritten
  to assert the NEW contract (errors propagate); two message asserts → `toThrow(MigrationApplyError/
  MigrationRollbackError)`.

## Validation — all green
typecheck ✅, lint ✅ (0 errors), unit ✅ 3516, integration ✅ 461, e2e ✅ 290, build ✅,
arch:deps/cycles/dead ✅.

## Changeset
`@ts-linq/migrations` **minor** (new public injectable ports/impls + additive ctor overload);
summary calls out the **data-corruption fix** (silent swallow → re-run risk).

## Follow-ups / tech debt
- MySQL existence probe doesn't filter by `table_schema = DATABASE()` → on a shared MySQL server
  another DB's `__migrations` could false-positive (benign: SELECT then succeeds/fails genuinely).
  Cross-dialect simplicity chosen; documented.
- Boundary smell persists: migrations re-implements dialect DDL instead of delegating to dialect
  packages (see task-6).
- Coordinates with task-3 (bundle/script code-gen also interpolates), task-5/6/7.
