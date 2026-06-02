---
status: not-started
phase: phase-x
package: provider-mysql
priority: P1
effort: S
risk: medium
category: error-handling
depends_on: ["provider-mssql/task-3.md"]
related: ["provider-mssql/task-3.md", "provider-postgres/task-3.md"]
---

# Refactor: Migrate MySQL error mapping to the shared error-translation registry

## Problem
`mapMySqlError` is a bespoke function and `transientErrorCodes.ts` a separate list, with a shape
mismatch: mapping keys on the string `code` (`ER_DUP_ENTRY`), transience keys on numeric `errno`.
This split means a constraint error and its transience are derived from two different fields.

## Evidence
- `packages/provider-mysql/src/MySqlProvider.ts:50-58` — `mapMySqlError` keys on string `code`.
- `:457-460` — `isTransientError` keys on numeric `errno` via `isMysqlTransientErrorCode`.
- `packages/provider-mysql/src/transientErrorCodes.ts:5-16` — numeric set + `errno` lookup.
- Coverage gap: only dup-entry + FK mapped; lock-wait/deadlock surface only as transient, not as typed errors; check/not-null fall through to `DatabaseError`.

## Why this is bad
- DRY/OCP: same problem as MSSQL/PG; three functions to edit for any new mapping.
- `code` vs `errno` split is error-prone and inconsistent with the other providers.

## Target architecture
Replace `mapMySqlError` + the transient list with a MySQL rule table consumed by the shared
`ErrorTranslator` (`provider-mssql/task-3.md`), normalizing `code`/`errno` via the shared
`extractDriverCode` adapter so both translation and transience read one model.

## Proposed refactor
1. Define MySQL `DriverErrorRule[]` (unique/FK/check/not-null).
2. Unify `code`/`errno` extraction.
3. Single transient policy shared by `translate` and `isTransientError`.

## Suggested design patterns
- **Strategy/Registry**, **Adapter** (heterogeneous error fields).

## Testing plan
- Unit: synthetic MySQL errors (`code`, `errno`) → correct typed error + transience verdict.
- Regression: CRUD error expectations unchanged.

## Acceptance criteria
- [ ] MySQL uses the shared `ErrorTranslator` with a rule table.
- [ ] `code`/`errno` normalized through one adapter.
- [ ] Transient data single-sourced with `isTransientError`.
- [ ] Unit tests cover every rule.

## Refactor order
Depends on `provider-mssql/task-3.md`.

## Notes
See anchor `provider-mssql/task-3.md`.
