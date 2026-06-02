---
status: not-started
phase: phase-x
package: provider-mssql
priority: P1
effort: M
risk: low
category: testing
depends_on: ["provider-mssql/task-7.md"]
related: ["provider-mysql/task-6.md", "provider-postgres/task-6.md"]
---

# Refactor: Add a shared provider contract test suite (driverless)

## Problem
Provider unit tests (`tests-new/*.test.ts`) only construct the provider and assert on config.
None of the execution behavior — CRUD, transaction state machine, savepoints, error mapping,
sequence reservation — is unit-tested, because it currently requires a real database. The only
real coverage is the container-backed `tests/*.crud.test.ts`, which is slow, flaky-prone, and
skipped in pure unit runs.

## Evidence
- `packages/provider-mssql/tests-new/MssqlProvider.test.ts:1-313` — every test is constructor/config only (e.g. `:8`, `:98`, `:112`).
- `packages/provider-postgres/tests-new/PostgresProvider.test.ts` and `packages/provider-mysql/tests-new/MySqlProvider.test.ts` follow the same constructor-only pattern.
- Execution paths with zero unit coverage: `insert/update/delete/upsert/find*`, `doBeginTransaction`/commit/rollback, savepoints, `nextSequenceValue`, `isTransientError`, error mapping.
- Real DB dependency forces this: `MssqlProvider.ts:434` `new mssql.Request(...)`, `MySqlProvider.ts:173` `pool.execute(...)`, `PostgresProvider.ts:422` `runner.query(...)`.

## Why this is bad
- Critical, frequently-edited execution code is unverifiable without infrastructure.
- Regressions in transaction-state transitions or error mapping cannot be caught in CI unit gates.
- Refactors (`task-1.md`) are high-risk without a behavioral safety net.

## Target architecture
Once driver DI exists (`task-7.md`), build a **shared, parameterized contract test suite** that
each provider runs against a **fake driver**. The suite asserts the provider's observable
behavior against the `DatabaseProvider` contract: transaction state machine, affected-row →
optimistic-concurrency mapping, error translation, savepoint SQL emitted, sequence value parsing.
Clean Code: tests describe behavior, not implementation; one suite, three bindings.

## Proposed refactor
1. Define a `runProviderContract(makeProvider, fakeDriver)` suite in a shared test util.
2. Provide a fake driver per provider (records SQL+params, returns scripted rows/rowcounts/errors).
3. Bind the suite in each `tests-new` file.
4. Add provider-specific cases for divergent behavior (MSSQL OUTPUT readback vs PG RETURNING vs MySQL insertId).

## Suggested design patterns
- **Test fixture / Object Mother** for entities + metadata.
- **Fake (Test Double)** for the driver port (`task-7.md`).
- **Parameterized/contract test** — one behavioral spec, multiple implementations.

## Testing plan
- Unit: the contract suite itself runs fully offline against fakes.
- Error-path: scripted driver errors assert typed ORM errors (ties to `task-3.md`).
- Regression: container tests remain as integration coverage, not the primary gate.

## Acceptance criteria
- [ ] A reusable `runProviderContract` suite exists and is bound by all three providers.
- [ ] CRUD, transaction state machine, savepoints, error mapping, sequences are covered offline.
- [ ] `pnpm tests:unit` exercises provider execution paths with no DB.
- [ ] Provider-specific PK-readback differences are covered.

## Refactor order
Depends on `task-7.md`. Land immediately after driver DI; provides the safety net for `task-1.md`.

## Notes
Cross-cutting testing task; filed under mssql. See `provider-mysql/task-6.md`, `provider-postgres/task-6.md`.
