---
status: not-started
phase: phase-x
package: provider-mssql
priority: P1
effort: M
risk: medium
category: error-handling
depends_on: []
related: ["provider-mysql/task-3.md", "provider-postgres/task-3.md"]
---

# Refactor: Unify driver error translation into an extensible registry/strategy

## Problem
Each provider has its own hand-rolled `mapXxxError()` free function plus its own
`transientErrorCodes.ts`. The three translators have **inconsistent shapes** (MSSQL keys on a
numeric `number`, PG on string `code`, MySQL on string `code` for mapping but `errno` for
transience) and **inconsistent error construction** (PG/MySQL pass the driver code as a 2nd arg
to the typed error; MSSQL drops it). Only `UniqueConstraintError`, `ForeignKeyConstraintError`,
and a catch-all `DatabaseError` are mapped — `OptimisticConcurrencyError`, check-constraint, and
not-null violations fall through to the opaque catch-all.

## Evidence
- `mapMssqlError` `packages/provider-mssql/src/MssqlProvider.ts:668-679` — keys on `number` (2627/2601/547); does **not** pass code into the error.
- `mapPgError` `packages/provider-postgres/src/PostgresProvider.ts:569-576` — keys on `code` ('23505'/'23503'); passes `code` to the error.
- `mapMySqlError` `packages/provider-mysql/src/MySqlProvider.ts:50-58` — keys on `code` ('ER_DUP_ENTRY'/…); passes `code`.
- Transience lists, all separate and shaped differently:
  - `packages/provider-mssql/src/transientErrorCodes.ts:5` (numbers, `isMssqlTransientErrorNumber`)
  - `packages/provider-mysql/src/transientErrorCodes.ts:5` (numbers via `errno`, `isMysqlTransientErrorCode`)
  - `packages/provider-postgres/src/transientErrorCodes.ts:5` (string codes, `isPgTransientErrorCode`)
- Transience consumers: `isTransientError` overrides at `MssqlProvider.ts:544`, `MySqlProvider.ts:457`, `PostgresProvider.ts:511`.

## Why this is bad
- DRY + Open/Closed violation: adding a new mapped error class means editing 3 functions in 3 packages.
- Inconsistent error payloads make consumer code provider-specific (the `code` field is sometimes present, sometimes not).
- Coverage gaps: not-null / check-constraint / serialization failures all collapse to `DatabaseError`, losing actionable typing.

## Target architecture
Introduce a shared, declarative **error-translation registry** (Strategy + table-driven) in
`@ts-linq/core` (or `@ts-linq/types`, which already exports the error classes — note the
boundary). A provider supplies a small descriptor:
```
interface DriverErrorRule { match(err): boolean; toError(err): DatabaseError; }
class ErrorTranslator { constructor(rules: DriverErrorRule[]) {} translate(err): Error }
```
Each provider declares its rule table (unique/FK/check/not-null/serialization → typed error)
plus a single source of truth for transient codes used by both `translate()` and
`isTransientError`. SOLID: SRP (translation isolated), OCP (add a rule, not edit a switch),
DIP (provider depends on the `ErrorTranslator` abstraction).

## Proposed refactor
1. Define `DriverErrorRule` + `ErrorTranslator` + a normalized `extractDriverCode(err)` helper.
2. Move the three `transientErrorCodes.ts` sets behind a uniform `TransientErrorPolicy` so `translate` and `isTransientError` share the data.
3. Replace `mapMssqlError`/`mapPgError`/`mapMySqlError` with per-provider rule tables.
4. Always attach the driver code to the typed error (fix the MSSQL omission).
5. Extend coverage to check-constraint and not-null where the driver exposes a distinct code.

## Suggested design patterns
- **Strategy / Registry (table-driven)** — rules are data, not control flow (extensibility).
- **Adapter** — `extractDriverCode` adapts heterogeneous driver error shapes to one model.

## Testing plan
- Unit: feed synthetic driver-error objects (numeric `number`, string `code`, `errno`) and assert the exact typed error + preserved code.
- Unit: transience policy returns the same verdict for `translate` and `isTransientError`.
- Regression: existing error-path expectations in CRUD tests unchanged.
- Error-path: each mapped constraint class is produced for its driver code.

## Acceptance criteria
- [ ] One `ErrorTranslator` abstraction reused by all three providers.
- [ ] Per-provider rule tables replace the three `mapXxxError` functions.
- [ ] Driver code is consistently attached to every typed error.
- [ ] Transient-code data is a single source of truth shared with `isTransientError`.
- [ ] Coverage extended to at least check-constraint / not-null where available.
- [ ] Unit tests cover every rule and the transience policy.

## Refactor order
Independent of the god-class split; can land first to de-risk `task-1.md`.

## Notes
Cross-cutting; filed under mssql (its mapper is the most broken — it silently drops the code).
See `provider-mysql/task-3.md` and `provider-postgres/task-3.md`.
