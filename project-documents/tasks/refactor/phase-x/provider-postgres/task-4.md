---
status: not-started
phase: phase-x
package: provider-postgres
priority: P1
effort: S
risk: low
category: provider
depends_on: ["provider-mssql/task-4.md"]
related: ["provider-mssql/task-4.md", "provider-mysql/task-4.md"]
---

# Refactor: Replace Postgres runtime `if (!dialect.buildX) throw` probes with the capability model

## Problem
Postgres probes optional dialect methods and throws a generic `Error`, the silent-feature-gap
pattern from the anchor task.

## Evidence
- `packages/provider-postgres/src/PostgresProvider.ts:209` `if (!dialect.buildInsert) throw new Error('Dialect does not support buildInsert');`
- `:230` (buildUpdate), `:303` (buildDelete).

## Why this is bad
- Untyped runtime errors; no discoverable capability surface; ISP/LSP tension across providers.

## Target architecture
Consume the shared `ProviderCapabilities` + `UnsupportedFeatureError` (`provider-mssql/task-4.md`).
Expose a frozen Postgres capabilities object (`supportsReturning=true`, `supportsReleaseSavepoint`,
`supportsServerSideExplainJson`, etc.) and guard via capability checks throwing the typed error.

## Proposed refactor
1. Return a Postgres capabilities object.
2. Replace the three probes with capability-guarded calls + typed error.

## Suggested design patterns
- **Capability object**, **Strategy**.

## Testing plan
- Unit: cleared capability throws `UnsupportedFeatureError`; capabilities match implemented methods.

## Acceptance criteria
- [ ] No `if (!dialect.buildX) throw new Error(...)` in Postgres.
- [ ] Postgres exposes a capabilities object consumed by guards.
- [ ] Unit tests cover present/absent capability behavior.

## Refactor order
Depends on `provider-mssql/task-4.md`.

## Notes
See anchor `provider-mssql/task-4.md`.
