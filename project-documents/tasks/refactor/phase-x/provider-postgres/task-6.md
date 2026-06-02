---
status: not-started
phase: phase-x
package: provider-postgres
priority: P1
effort: S
risk: low
category: testing
depends_on: ["provider-postgres/task-7.md", "provider-mssql/task-6.md"]
related: ["provider-mssql/task-6.md", "provider-mysql/task-6.md"]
---

# Refactor: Bind the shared provider contract suite for Postgres (driverless)

## Problem
`tests-new/PostgresProvider.test.ts` covers only construction/config; no Postgres execution
behavior (RETURNING readback, transaction-client pinning, error mapping, sequence reservation,
idle-error handling) is unit-tested.

## Evidence
- `packages/provider-postgres/tests-new/PostgresProvider.test.ts` — constructor/config tests only.
- Untested execution: `doExecuteQuery :416`, `doExecuteNonQuery :430`, transactions `:462-508`, `nextSequenceValue :521`, idle-error handler `:154-157`.

## Why this is bad
- Critical execution code unverifiable offline; refactors (task-1) lack a safety net.

## Target architecture
Bind the shared `runProviderContract` suite (`provider-mssql/task-6.md`) with a fake `pg` port
(task-7), plus Postgres-specific cases: RETURNING readback, transaction-client acquire/release,
idle-error handler does not crash, `ON CONFLICT` upsert.

## Proposed refactor
1. Implement a fake `PgPoolLike`/`PgClientLike` recording SQL/params + scripted results.
2. Bind the contract suite and add Postgres-specific cases.

## Suggested design patterns
- **Fake (Test Double)**, **parameterized/contract test**, **Object Mother**.

## Testing plan
- Unit: contract suite + Postgres cases run fully offline.
- Error-path: scripted SQLSTATE errors → typed ORM errors.
- Unit: begin acquires a client; commit/rollback release it exactly once.

## Acceptance criteria
- [ ] Contract suite bound for Postgres with a fake driver.
- [ ] RETURNING, client pinning, upsert, idle-error covered offline.
- [ ] `pnpm tests:unit` exercises Postgres execution paths with no DB.

## Refactor order
Depends on task-7 and `provider-mssql/task-6.md`.

## Notes
See anchor `provider-mssql/task-6.md`.
