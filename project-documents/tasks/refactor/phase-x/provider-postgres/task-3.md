---
status: not-started
phase: phase-x
package: provider-postgres
priority: P1
effort: S
risk: medium
category: error-handling
depends_on: ["provider-mssql/task-3.md"]
related: ["provider-mssql/task-3.md", "provider-mysql/task-3.md"]
---

# Refactor: Migrate Postgres error mapping to the shared error-translation registry

## Problem
`mapPgError` is a bespoke function and `transientErrorCodes.ts` a separate string-code list. Only
unique (`23505`) and FK (`23503`) violations are mapped; check-constraint (`23514`), not-null
(`23502`), and serialization failures (`40001`, already in the transient set) fall through to a
generic `DatabaseError`.

## Evidence
- `packages/provider-postgres/src/PostgresProvider.ts:569-576` — `mapPgError` maps only `23505`/`23503`.
- `:511-514` — `isTransientError` via `isPgTransientErrorCode`.
- `packages/provider-postgres/src/transientErrorCodes.ts:5-19` — separate string-code set.

## Why this is bad
- DRY/OCP: three independent mappers across the cluster.
- Coverage gaps collapse distinct SQLSTATE classes into one opaque error, losing actionable typing.

## Target architecture
Replace `mapPgError` + the transient list with a Postgres `DriverErrorRule[]` consumed by the
shared `ErrorTranslator` (`provider-mssql/task-3.md`), keyed on SQLSTATE via the shared
`extractDriverCode`, with the transient set as the single source for both translation and
`isTransientError`. Extend coverage to `23514`/`23502`.

## Proposed refactor
1. Define Postgres rule table (unique/FK/check/not-null).
2. Single transient policy shared with `isTransientError`.

## Suggested design patterns
- **Strategy/Registry (SQLSTATE table-driven)**, **Adapter**.

## Testing plan
- Unit: synthetic SQLSTATE errors → correct typed error + transience verdict.
- Regression: CRUD error expectations unchanged.

## Acceptance criteria
- [ ] Postgres uses the shared `ErrorTranslator` with a SQLSTATE rule table.
- [ ] Coverage extended to check-constraint / not-null.
- [ ] Transient data single-sourced with `isTransientError`.
- [ ] Unit tests cover every rule.

## Refactor order
Depends on `provider-mssql/task-3.md`.

## Notes
See anchor `provider-mssql/task-3.md`.
