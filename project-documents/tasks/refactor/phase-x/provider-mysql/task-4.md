---
status: not-started
phase: phase-x
package: provider-mysql
priority: P1
effort: S
risk: low
category: provider
depends_on: ["provider-mssql/task-4.md"]
related: ["provider-mssql/task-4.md", "provider-postgres/task-4.md"]
---

# Refactor: Replace MySQL runtime `if (!dialect.buildX) throw` probes with the capability model

## Problem
MySQL probes optional dialect methods at runtime and throws a generic `Error`, the same
silent-feature-gap pattern flagged in the anchor task.

## Evidence
- `packages/provider-mysql/src/MySqlProvider.ts:155` `if (!dialect.buildInsert) throw new Error('Dialect does not support buildInsert');`
- `:200` (buildUpdate), `:257` (buildDelete).

## Why this is bad
- Untyped runtime errors; no discoverable capability surface; inconsistent with a uniform provider contract (ISP/LSP tension).

## Target architecture
Consume the shared `ProviderCapabilities` + `UnsupportedFeatureError` (`provider-mssql/task-4.md`).
Expose a frozen capabilities object (`supportsUpsert`/`supportsReleaseSavepoint=true`, etc.) and
guard via capability checks throwing the typed error.

## Proposed refactor
1. Return a MySQL capabilities object.
2. Replace the three probes with capability-guarded calls and the typed error.

## Suggested design patterns
- **Capability object**, **Strategy**.

## Testing plan
- Unit: cleared capability throws `UnsupportedFeatureError`; capabilities match implemented methods.

## Acceptance criteria
- [ ] No `if (!dialect.buildX) throw new Error(...)` in MySQL.
- [ ] MySQL exposes a capabilities object consumed by guards.
- [ ] Unit tests cover present/absent capability behavior.

## Refactor order
Depends on `provider-mssql/task-4.md`.

## Notes
See anchor `provider-mssql/task-4.md`.
