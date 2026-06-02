---
status: not-started
phase: phase-x
package: provider-mysql
priority: P1
effort: M
risk: high
category: provider
depends_on: []
related: ["provider-mssql/task-8.md"]
---

# Refactor: Eliminate the forked `executeInsert` pipeline and the connectionless transaction-state risk

## Problem
Two MySQL-specific correctness/consistency issues:
1. `executeInsert` re-implements the execution pipeline (`connect` → `beforeExecute` →
   `pool.execute` → `afterExecute`) **separately** from `doExecuteNonQuery`, so insert statements
   take a different code path for connection-ensuring, hooks, resilience, and error handling than
   every other statement. This is duplicated logic that will drift.
2. Transactions are run on the **pool** (`pool.query('START TRANSACTION')`), not a pinned
   connection. With a pooled driver, `START TRANSACTION`, subsequent statements, and `COMMIT` may
   execute on **different physical connections**, silently breaking transaction isolation. Postgres
   correctly pins a client (`PostgresProvider.ts:465-481`); MySQL does not.

## Evidence
- Forked pipeline: `packages/provider-mysql/src/MySqlProvider.ts:165-181` `executeInsert` (its own `connect`, `beforeExecute`, `afterExecute`, `mapMySqlError`).
- Pool-level transactions: `doBeginTransaction :414-420` `await pool.query('START TRANSACTION')`; `doCommitTransaction :421-427` `pool.query('COMMIT')`; `doRollbackTransaction :428-434` `pool.query('ROLLBACK')`.
- `doExecuteQuery :370` / `doExecuteNonQuery :384` also use `this.pool` directly, so even in-transaction reads/writes are not pinned to the transaction connection.
- Savepoints `:438-454` likewise run on the pool.

## Why this is bad
- **Correctness:** unpinned pool transactions are a real isolation bug — concurrent transactions can interleave on shared connections; `COMMIT`/`ROLLBACK` may apply to the wrong connection.
- **DRY/observability:** the insert fork means insert hooks/resilience/error handling differ from other statements; bug fixes must be applied twice.

## Target architecture
1. Pin a dedicated connection for the duration of a transaction (acquire on begin, release on
   commit/rollback), mirroring the Postgres `transactionClient` pattern; route all in-transaction
   statements (incl. savepoints) through that pinned connection. This belongs in the
   `MySqlTransactionManager` collaborator from `task-1.md`.
2. Remove `executeInsert`; let `insert` use the unified execute path and read `insertId` from the
   standard result object. SOLID: SRP (one execute pipeline), DRY.

## Proposed refactor
1. Add a pinned-connection field; acquire in `doBeginTransaction`, use in `doExecute*` + savepoints, release in commit/rollback.
2. Delete `executeInsert`; obtain `insertId` from `doExecuteNonQuery`'s result (extend it to surface `insertId`, or add a dedicated `executeInsertStatement` that still reuses the shared hooks/resilience).

## Suggested design patterns
- **Unit of Work / pinned connection** for transaction scope.
- **Template Method** — single execute pipeline with one variation point for insertId.

## Testing plan
- Unit (fake driver, task-7): begin → execute → commit all use the same pinned connection handle; concurrent transactions do not share a connection.
- Unit: insert flows through the unified pipeline (hooks fire once, error mapping shared).
- Regression: container CRUD + transaction tests pass.

## Acceptance criteria
- [ ] In-transaction statements (incl. savepoints) run on a single pinned connection.
- [ ] `executeInsert` is removed; insert uses the unified pipeline.
- [ ] Hooks/resilience/error-mapping are identical for insert and other statements.
- [ ] Unit tests assert connection pinning and single-pipeline behavior.

## Refactor order
The transaction-pinning part should land with `task-1.md` (transaction manager). The insert-fork
removal can land independently but pairs naturally with task-1.

## Notes
This is the highest-severity MySQL-specific finding (silent transaction isolation bug). Related to
the general silent-path concern in `provider-mssql/task-8.md`.
