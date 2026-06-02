---
status: not-started
phase: phase-x
package: provider-mysql
priority: P1
effort: M
risk: medium
category: architecture
depends_on: ["provider-mssql/task-2.md"]
related: ["provider-mssql/task-2.md", "provider-postgres/task-2.md"]
---

# Refactor: Adopt the shared `EntityMapper` + `ValueCoercer` in MySQL

## Problem
`MySqlProvider` carries its own private `mapRowToEntity` and `coerceToSqlParameter`, near-identical
to the MSSQL/Postgres copies. MySQL's coercer notably does **not** map `undefined→null` (MSSQL
does), and its `upsert`/`findWhere` build params without going through the coercer at all — a
latent inconsistency.

## Evidence
- `packages/provider-mysql/src/MySqlProvider.ts:513-531` — `mapRowToEntity`.
- `:492-511` — `coerceToSqlParameter` (only handles WKB; no `undefined` branch unlike MSSQL `:596`).
- `upsert :236-238` builds params via a raw cast `as SqlParameter`, bypassing the coercer (geometry in an upsert would not be encoded).

## Why this is bad
- DRY across the package boundary; bug fixes applied 3×.
- Coercion is applied inconsistently within MySQL itself (find* uses it; upsert does not), so spatial values silently break on upsert.

## Target architecture
Consume the shared `EntityMapper` + `ValueCoercer` (defined in `provider-mssql/task-2.md`),
injecting MySQL's encoder list (`GeometryEncoder` → WKB) and routing **all** parameter building —
including upsert — through the coercer. SOLID: SRP/DIP/OCP as in the anchor task.

## Proposed refactor
1. Remove the two private methods.
2. Provide MySQL's `ParameterEncoder[]` (WKB) to the shared `ValueCoercer`.
3. Route `upsert` params through the coercer.

## Suggested design patterns
- **Strategy** (encoders), **Composite/Chain** (encoder list), **Composition over inheritance**.

## Testing plan
- Unit: coercer with WKB encoder + primitive/JSON tail; assert `undefined` rule matches the unified decision.
- Provider: upsert with a geometry value is encoded (regression for the current bypass).
- Regression: existing CRUD tests pass.

## Acceptance criteria
- [ ] No `mapRowToEntity`/`coerceToSqlParameter` in `MySqlProvider`.
- [ ] Upsert params go through the shared coercer.
- [ ] Unified `undefined` behavior applied.
- [ ] Unit tests cover the MySQL encoder list.

## Refactor order
Depends on `provider-mssql/task-2.md` defining the shared collaborators.

## Notes
See anchor `provider-mssql/task-2.md`.
