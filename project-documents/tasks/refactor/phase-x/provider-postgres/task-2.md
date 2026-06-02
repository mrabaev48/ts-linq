---
status: not-started
phase: phase-x
package: provider-postgres
priority: P1
effort: M
risk: medium
category: architecture
depends_on: ["provider-mssql/task-2.md"]
related: ["provider-mssql/task-2.md", "provider-mysql/task-2.md"]
---

# Refactor: Adopt the shared `EntityMapper` + `ValueCoercer` in Postgres (with a `TypeReader`)

## Problem
`PostgresProvider` carries the third copy of `mapRowToEntity`/`coerceToSqlParameter` plus two free
functions `convertValueForPg`/`convertValueFromPg`. It is the **diverged** copy — `mapRowToEntity`
routes raw values through `convertValueFromPg`, and `coerceToSqlParameter` omits the `undefined`
branch present in MSSQL. This proves the triplication has already drifted.

## Evidence
- `packages/provider-postgres/src/PostgresProvider.ts:67-85` — `mapRowToEntity`, calls `convertValueFromPg(rawVal, col.type)` at `:76` (divergence vs MSSQL/MySQL).
- `:110-132` — `coerceToSqlParameter` (ltree + EWKB-hex; no `undefined` branch unlike MSSQL `:596`).
- `convertValueForPg :537-546`, `convertValueFromPg :549-567` — Postgres type glue.
- `findWhereIn :402-407` casts an array straight to `SqlParameter` (`values as unknown as SqlParameter`) for `ANY(?)`, a type hole that bypasses coercion.

## Why this is bad
- DRY across the boundary; the three copies have already diverged → confirmed drift, not hypothetical.
- The Postgres-only type-reading layer is fused into the mapper, blocking reuse and isolated testing.
- The `findWhereIn` cast defeats the type system and the coercer.

## Target architecture
Consume the shared `EntityMapper` + `ValueCoercer` (`provider-mssql/task-2.md`). Postgres supplies:
- a `TypeReader` wrapping `convertValueFromPg` (read side),
- an encoder list (`HierarchyIdEncoder`→ltree, `GeometryEncoder`→EWKB-hex) plus a JSON write
  pre-step equivalent to `convertValueForPg` for the coercer.
Route `findWhereIn` array params through a typed array-parameter path instead of the `unknown` cast.
SOLID: SRP/DIP/OCP as in the anchor.

## Proposed refactor
1. Remove the two private methods; keep `convertValueForPg`/`convertValueFromPg` as the Postgres `TypeReader`/JSON pre-step injected into the shared collaborators.
2. Unify the `undefined` rule with the shared decision.
3. Replace the `findWhereIn` cast with a typed array parameter representation.

## Suggested design patterns
- **Strategy** (`TypeReader`, encoders), **Composite/Chain** (encoder list), **Composition over inheritance**.

## Testing plan
- Unit: mapper with Postgres `TypeReader` (BOOLEAN/INTEGER/TIMESTAMPTZ/JSONB conversions).
- Unit: coercer with ltree + EWKB-hex encoders + JSON pre-step + unified `undefined` rule.
- Provider: `findWhereIn` array path typed correctly; round-trip.
- Regression: existing CRUD + snapshot tests pass.

## Acceptance criteria
- [ ] No `mapRowToEntity`/`coerceToSqlParameter` in `PostgresProvider`.
- [ ] `convertValueFromPg` reused via a `TypeReader`, not a private mapper.
- [ ] Unified `undefined` behavior.
- [ ] `findWhereIn` no longer uses `as unknown as SqlParameter`.
- [ ] Unit tests cover the Postgres reader + encoders.

## Refactor order
Depends on `provider-mssql/task-2.md`.

## Notes
Postgres is the canonical drift example — call this out when designing the shared collaborators.
See anchor `provider-mssql/task-2.md`.
