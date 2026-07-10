# dialect-postgres/task-2 — Dialect capability model (✅ completed)

Branch: `audit-refactor/dialect-capability-model` (created from local `main`; origin remote was
unreachable — "Repository not found" — push/PR deferred).

## What changed

**`@ts-linq/types`** (`packages/types/src/dialect.ts`, `runtime.ts`) — additive, `minor` (4.10.0 → 4.11.0):
- `DialectCapabilities` interface: `{ crud, batch, bulk, storedProcedures, temporal }` (all `boolean`).
- Segregated capability interfaces: `SupportsCrud`, `SupportsBatch`, `SupportsBulk`,
  `SupportsStoredProcedures`, `SupportsTemporal` (the last is an empty marker — temporal has no
  distinct method, it's enforced inside `buildSelect` via the existing
  `AbstractSqlDialect.assertTemporalSupported`/`TemporalNotSupportedError`).
- `SqlDialect.capabilities?: DialectCapabilities` — added as **optional** (deliberate deviation from
  a literal reading of the task file, confirmed with the user): making it (or the existing
  buildInsert/Update/Delete/etc. methods) required would have broken ~20 `implements SqlDialect` test
  doubles in `core`/`query`/`cli`/`testkits` that are out of scope for this task.
- Assertion-function guards in `runtime.ts` (the package's one behavior-carrying module, alongside
  `ok`/`err`/`isTemplateSqlCache`/`maskSql`): `requireCrud`, `requireBatch`, `requireBulk`,
  `requireStoredProcedures`, `requireTemporal`. Each is `(dialect: SqlDialect): asserts dialect is
  SqlDialect & SupportsX`. Logic: prefer `dialect.capabilities?.X`; **fall back to method-presence
  `typeof === 'function'` sniffing when `capabilities` is absent** — this fallback is what keeps every
  pre-existing `SqlDialect` implementer (test doubles etc.) working unchanged. Throws the *existing*
  `UnsupportedOperationError` (crud/batch/bulk/SP) or `TemporalNotSupportedError` (temporal) — no new
  error classes, per CLAUDE.md §16.

**Three concrete dialects** — each `minor` bump, each declares a literal, accurate matrix:
- `PostgresDialect`, `MysqlDialect`: `{ crud:true, batch:true, bulk:true, storedProcedures:true,
  temporal:false }`.
- `MssqlDialect`: same but **`temporal:true`** — the only dialect supporting `FOR SYSTEM_TIME`.
- `AbstractSqlDialect` (`@ts-linq/dialect-kit`) now also `implements SupportsCrud, SupportsBulk`
  (it already concretely implements those methods — this just makes the structural fact explicit).
  Each concrete dialect additionally `implements SupportsBatch, SupportsStoredProcedures`
  (+ `SupportsTemporal` for MSSQL only, marker).

**Three providers** — each `patch` bump:
- `PostgresProvider`/`MySqlProvider`: replaced `if (!dialect.buildX) throw new Error(...)` (a
  CLAUDE.md §16 violation — plain `Error`, not `OrmError`) with `requireCrud(dialect)` before
  insert/update/delete.
- **`MssqlProvider` (the actual bug fix)**: previously cast `this.getDialect() as MssqlDialect` and
  called `buildInsert/Update/Delete` with **no guard at all** — a latent uncaught `TypeError` if a
  dialect/double omitted them. Now: `const dialect = this.getDialect(); requireCrud(dialect);` — no
  concrete-class cast, same typed-error behavior as PG/MySQL. `returningPk` (used in `insert()`) is
  already on `SqlWithReturning` in the public interface, so nothing was lost by dropping the cast.

**Coordination**: `dialect-mssql/task-4.md` (the MSSQL-specific manifestation of this bug) is now
`status: superseded` — resolved directly by the long-term fix, no interim guard was needed.

## Self-review (/simplify, 4 parallel agents) — 2 fixes applied
- **Altitude gap (applied):** `AbstractSqlDialect` implemented `SupportsCrud`/`SupportsBulk` but
  did not force `capabilities` as abstract — a future dialect extending the shared base could
  silently omit it and fall through to the sniffing fallback forever. Fixed by adding
  `public abstract readonly capabilities: DialectCapabilities;` to `AbstractSqlDialect` — does
  NOT affect any of the ~20 unrelated test doubles (they implement `SqlDialect` directly, not the
  abstract base). Required updating one in-package test double,
  `packages/dialect-kit/tests-new/AbstractSqlDialect.test.ts`'s `TestDialect`, to declare a
  `capabilities` literal.
- **Boilerplate (applied):** extracted `throwUnsupportedCapability(dialect, capability, methods)`
  in `runtime.ts` to dedupe the throw-and-message-format ceremony across the 4 method-sniffing
  `require*` functions (not `requireTemporal`, which has a different error type/no method list).
  The `asserts` return type itself was NOT delegated (TS can't propagate `asserts` through a
  helper call) — only the throw body was factored out.
- **Skipped (judged not worth it / false positive):** collapsing the 5 `require*` signatures
  entirely (would lose per-function `asserts` narrowing); dropping the `SupportsTemporal` empty
  marker (harmless, kept for symmetry/documentation); "hoist capability check to construction
  time" efficiency suggestion (mis-reads `??` — when `capabilities` is present, as it always is
  for the 3 production dialects, the fallback `typeof` checks never even evaluate; cost is one
  optional-chain property read per call, negligible).
- **Found but deliberately deferred (spawned as separate follow-up tasks, not fixed inline):**
  `packages/orm/src/save-changes/sp-executor.ts` (bare `new Error` for missing
  `getSpCallSyntax`) and `packages/orm/src/save-changes/batch-executor.ts` (3 silent
  presence-check fallbacks for buildBatch*) also duplicate what `requireStoredProcedures`/
  `requireBatch` now centralize — found by the reuse-angle agent, out of task-2.md's named scope
  (only the 3 providers), same reasoning as `FragmentDmlExecutor`/`BulkDmlExecutor` below.

## Deliberately out of scope
- `packages/orm/src/commands/FragmentDmlExecutor.ts` (`if (!dialect.buildInsert) return;` — silent
  no-op, different semantics) and `packages/query/src/BulkDmlExecutor.ts` (`if (!dialect.buildBulkUpdate)
  throw new Error(...)`) were **not** migrated to `requireCrud`/`requireBulk` — task-2.md's evidence
  section names only the 3 providers. Flagged as tech-debt follow-up.
- `parameterLimit` on `SqlDialect` stayed optional (not promoted to "required core" per the task's
  aspirational wording) — same blast-radius reasoning as `capabilities`.

## Tests added
- `packages/types/src/__tests__/dialectCapabilities.test.ts` — unit + type-narrowing coverage for all
  5 `require*` helpers (capabilities-present path, fallback-sniffing path, throw path, narrowing path).
- `capabilities` matrix assertion appended to each dialect's existing `tests-new/dialect/*Dialect.test.ts`.
- "CRUD capability guard" describe block appended to each provider's `tests-new/*Provider.test.ts` —
  a dialect double lacking `buildInsert`/`buildUpdate`/`buildDelete` and no `capabilities` → all three
  providers (including MSSQL) reject with `UnsupportedOperationError`, proven via `jest.spyOn(provider,
  'getDialect').mockReturnValue(...)` (no real DB connection needed — the guard throws before any
  `executeQuery`/`executeNonQuery` call).
- `packages/types/tests/type-exports.test.ts` — updated the runtime-export manifest list to include
  the 5 new `require*` exports (this is the one pre-existing test that legitimately needed updating).

## Validation status (all green)
`pnpm typecheck` (34/34 packages, including the ~20 test-double dialects — proving the
backward-compat design works), `pnpm lint` (0 errors), `pnpm test:unit` (407 suites / 4190 tests),
`pnpm test:integration` (88 suites / 461 tests, real PG+MySQL+MSSQL via Docker), `pnpm test:e2e`
(19 suites / 290 tests), `pnpm build`, `pnpm arch:deps` (0 violations), `pnpm arch:cycles` (0 cycles),
`pnpm arch:dead` (0 dead exports). Re-verified (typecheck/lint/unit/integration/e2e/build/arch) after
the two self-review fixes above — all green again. Note: unit runs occasionally hit an unrelated
flaky jest-worker `SIGSEGV` on a random, untouched test file (transformer/transformer-morph
packages) — a re-run always passes; not caused by this change.

## Docs updated
- `project-documents/tasks/refactor/phase-x/dialect-postgres/task-2.md` — `status: completed` +
  Resolution section documenting the optional-vs-required deviation.
- `project-documents/tasks/refactor/phase-x/dialect-mssql/task-4.md` — `status: superseded` +
  Resolution section.
- `project-documents/tasks/refactor/phase-x/dialect-postgres/README.md` — task-2 ✅ in task index +
  recommended order table.
- `project-documents/tasks/refactor/README.md` — completion tracking table: dialect-postgres row adds
  task-2 to the done list; dialect-mssql row now 🔄 In Progress (task-4 ✅ superseded) instead of
  not-started. `dialect-postgres` package status stays 🔄 In Progress (task-8/10/11/12 still open).

## Changeset
Single file `.changeset/dialect-capability-model.md` (already consumed via `pnpm changeset version`):
`@ts-linq/types` minor, `@ts-linq/dialect-postgres`/`dialect-mysql`/`dialect-mssql` minor,
`@ts-linq/provider-postgres`/`provider-mysql`/`provider-mssql` patch. Note:
`updateInternalDependencies: patch` in `.changeset/config.json` cascaded a patch bump to **all 62**
monorepo packages (everything transitively depends on `@ts-linq/types`) — this is expected/correct
changesets behavior for this repo, not a mistake.

## Next open dialect-postgres tasks
task-8 (dead exports/OptionsBuilder dedup/dialect→core coupling), task-10/11/12 (tech debt from
task-7, DDL-generator convergence).
