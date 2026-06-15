---
status: completed
phase: phase-x
package: migrations
priority: P0
effort: L
risk: high
category: architecture
depends_on: ["task-4.md"]
related: ["task-1.md"]
---

# Refactor: Decompose MigrationRunner (history store, logging, typed errors, tx safety)

## Problem

`MigrationRunner` is a single class that simultaneously: orchestrates apply/rollback,
owns the bookkeeping-table DDL per dialect, performs raw SQL persistence with
provider-specific placeholders, logs to `console`, swallows errors, and re-throws
generic `Error` instances that destroy the original cause. It is the most
operationally-critical code in the package and is effectively untestable in isolation.

## Evidence

- `packages/migrations/src/MigrationRunner.ts:37-60` — `buildEnsureTableSql` embeds
  dialect-specific DDL inside the runner, keyed off `this._provider.providerLabel as string`.
- `packages/migrations/src/MigrationRunner.ts:64-79` — `getAppliedMigrations` wraps the
  query in `try { … } catch (error) { return []; }` — **invalid silent swallow**: a real
  permission/connection error is indistinguishable from "table not yet created", so a
  failing DB silently looks like "no migrations applied".
- `packages/migrations/src/MigrationRunner.ts:90,102,126,137` — direct `console.log` in a
  library (no injected logger, not suppressible, pollutes consumer stdout).
- `packages/migrations/src/MigrationRunner.ts:96-98,132-134` — persistence uses `?`
  placeholders hardcoded; this is provider/dialect-specific (PG uses `$1`, MSSQL `@p1`).
- `packages/migrations/src/MigrationRunner.ts:103-106,138-141` — on failure:
  `await rollbackTransaction(); throw new Error(\`Failed … ${error}\`)` —
  **cleanup-with-rethrow but cause-destroying**: the `${error}` stringification loses the
  stack/`cause`, and a throw from `rollbackTransaction()` itself would mask the original.
- `packages/migrations/src/script/idempotent-emitter.ts:91-136` — defines the
  `__migrations` table independently and with different column types than the runner
  (`TEXT` vs `NVARCHAR(50)` etc.), risking schema drift between the two code paths.

## Why this is bad

- **Untestable critical path:** apply/rollback ordering, history writes, and transaction
  semantics can only be exercised against a live DB.
- **Silent failure:** the swallow in `getAppliedMigrations` can cause already-applied
  migrations to be re-run (data corruption / duplicate DDL).
- **Lost diagnostics:** generic re-throw with `${error}` makes production migration
  failures hard to diagnose; no error code/context.
- **Boundary leakage:** placeholder syntax and bookkeeping DDL belong to the provider,
  not the runner.

## Target architecture

Apply **SRP**, **dependency inversion**, and a thin **Clean Architecture** use-case
layer:

- `MigrationHistoryStore` (interface) — `ensureExists()`, `list()`, `record(version,
  name, appliedAt)`, `remove(version)`. Provider/dialect detail lives behind it; the
  runner depends on the abstraction.
- `MigrationRunner` becomes an orchestrator that depends on
  `{ historyStore, transactionScope, logger }`, all injected (composition-first).
- `TransactionScope` helper that guarantees commit-on-success / rollback-on-failure and
  preserves the original error if rollback also throws (suppressed-error chaining).
- Typed errors from task-4 (`MigrationApplyError`, `MigrationRollbackError`) with
  `cause`, `version`, `name`, and a stable `code`.
- An injected `Logger` port (telemetry-with-rethrow at boundaries; no `console` in the
  library).
- The `__migrations` schema is defined once and shared by the runner and the idempotent
  emitter (single source of truth).

## Proposed refactor

1. Introduce `MigrationHistoryStore` interface + a default implementation that delegates
   bookkeeping DDL/placeholder selection to the provider/dialect layer (or a shared
   `MigrationsTableSchema` constant).
2. Add a `Logger` port (mirroring the CLI's `ports/Logger`) defaulting to a no-op so
   library callers opt in.
3. Extract `TransactionScope.run(fn)` that begins, runs, commits, and on throw rolls back
   while attaching the rollback failure as a suppressed error.
4. Replace generic throws with task-4 typed errors preserving `cause`.
5. Distinguish "table missing" from "query failed" in `list()` (check existence rather
   than swallowing all errors).
6. Make the `__migrations` definition shared with `idempotent-emitter`.

Backward compatibility: keep `new MigrationRunner(provider)` working by defaulting the
new collaborators; add an overload/options object for injection.

## Suggested design patterns

- **Repository** (`MigrationHistoryStore`) — isolates persistence. Why: testable with an
  in-memory fake; removes raw SQL from the orchestrator.
- **Template Method / Scoped Resource** (`TransactionScope`) — centralizes
  begin/commit/rollback. Why: removes duplicated try/catch and fixes cause-masking.
- **Dependency Injection** for logger + store. Why: removes `console`, enables unit tests.
- **Typed error hierarchy** (task-4). Why: codes + context + cause for ops diagnosis.

## Testing plan

- **Unit (fake provider/store):** assert begin→up→record→commit order on success; assert
  rollback + typed error with preserved `cause` on `up()` failure; assert rollback-failure
  is surfaced as suppressed without masking the original.
- **Unit:** `list()` returns `[]` only when the table is genuinely absent; a query error
  on an existing table propagates a typed error.
- **Regression:** existing `tests-new/MigrationRunner.test.ts` continues to pass.
- **Contract:** `MigrationHistoryStore` fake and real impl share the same behavioural
  test suite.

## Acceptance criteria

- [ ] `MigrationRunner` no longer calls `console.*`; logging goes through an injected port.
- [ ] No generic `throw new Error(...${error})`; failures throw task-4 typed errors with
      `cause`, `version`, `name`, `code`.
- [ ] `getAppliedMigrations`/`list()` no longer swallows non-"missing table" errors.
- [ ] Transaction commit/rollback is centralized and rollback-failure does not mask the
      original error.
- [ ] `__migrations` schema is defined once and shared with the idempotent emitter.
- [ ] Public constructor `new MigrationRunner(provider)` still works.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Land task-4 typed errors.
2. Extract `MigrationHistoryStore` + `Logger` port + `TransactionScope`.
3. Re-wire `MigrationRunner` to compose them.
4. Share `__migrations` schema with the emitter.

## Notes

The placeholder mismatch (`?` vs `$1` vs `@p1`) is currently masked because the providers
likely normalize `?`. Confirm via the provider packages before relying on it; if true,
document it, otherwise route placeholders through the store/provider.
