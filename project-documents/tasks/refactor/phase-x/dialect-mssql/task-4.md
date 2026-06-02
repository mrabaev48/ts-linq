---
status: not-started
phase: phase-x
package: dialect-mssql
priority: P2
effort: S
risk: medium
category: error-handling
depends_on: []
related: ['dialect-postgres/task-2.md', 'dialect-mysql/task-1.md']
---

# Refactor: MSSQL provider calls optional dialect methods without guards (latent TypeError)

## Problem
Because `SqlDialect.buildInsert/buildUpdate/buildDelete` are declared optional, the PostgreSQL and MySQL
providers guard each call with `if (!dialect.buildX) throw new Error(...)`. The **MSSQL provider does not** —
it calls the optional methods directly. If a dialect (or a test double) omits one, MSSQL fails with an opaque
`TypeError: dialect.buildInsert is not a function` instead of the descriptive error the other providers raise.

## Evidence
- Unguarded direct calls in MSSQL provider:
  - `packages/provider-mssql/src/MssqlProvider.ts:205` `dialect.buildInsert(...)`.
  - `packages/provider-mssql/src/MssqlProvider.ts:235` `dialect.buildUpdate(...)`.
  - `packages/provider-mssql/src/MssqlProvider.ts:269` `dialect.buildDelete(...)`.
- Guarded equivalents elsewhere:
  - `packages/provider-postgres/src/PostgresProvider.ts:209,230,303` (`if (!dialect.buildX) throw`).
  - `packages/provider-mysql/src/MySqlProvider.ts:155,200,257`.

## Why this is bad
- Inconsistent failure mode across providers; MSSQL degrades to an opaque runtime `TypeError`.
- Symptom of the deeper design flaw: optional methods used in place of a typed capability contract
  (host `dialect-postgres/task-2.md` — capability model).

## Target architecture
- Resolve at the root via the capability model (host task): a typed `requireCrud(dialect)` assertion makes the
  method statically present, eliminating ad-hoc guards across all three providers uniformly.
- Until then, add the same descriptive guard to MSSQL for consistency.

## Proposed refactor
1. Short-term: add `if (!dialect.buildInsert/Update/Delete) throw` guards to `MssqlProvider` to match siblings.
2. Long-term: replace all three providers' guards with the shared assertion from the capability model.

## Suggested design patterns
- **Assertion function (`asserts x is T`)** from the capability model. WHY: compile-time guarantee, single guard.
- **Fail-fast with descriptive error**. WHY: consistent, debuggable failure across providers.

## Testing plan
- Provider test: a dialect without `buildInsert` throws the same descriptive error from all three providers.

## Acceptance criteria
- [ ] MSSQL provider no longer throws an opaque `TypeError` for missing CRUD methods.
- [ ] Failure mode is identical across PG/MySQL/MSSQL providers.
- [ ] Superseded by the capability-model assertion once it lands.

## Refactor order
1. Add interim guards (immediate). 2. Replace with capability assertion when host `dialect-postgres/task-2.md` lands.

## Notes
This is filed under `dialect-mssql` because the defect is MSSQL-provider-specific, though the root cause is the
cluster-wide optional-method design tracked by the capability-model task.
