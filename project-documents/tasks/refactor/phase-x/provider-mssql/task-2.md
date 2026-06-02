---
status: not-started
phase: phase-x
package: provider-mssql
priority: P1
effort: L
risk: medium
category: architecture
depends_on: []
related: ["provider-mysql/task-2.md", "provider-postgres/task-2.md"]
---

# Refactor: Extract shared `EntityMapper` + `ValueCoercer` collaborators (kill `mapRowToEntity`/`coerceToSqlParameter` triplication)

## Problem
`mapRowToEntity()` and `coerceToSqlParameter()` are near-identical across all three providers
but are **private instance methods**, so the duplication cannot be shared and drifts silently.
The Postgres copy already diverges (it routes through `convertValueFromPg`), proving the drift risk.

## Evidence
- `mapRowToEntity`:
  - `packages/provider-mssql/src/MssqlProvider.ts:575-593`
  - `packages/provider-mysql/src/MySqlProvider.ts:513-531`
  - `packages/provider-postgres/src/PostgresProvider.ts:67-85` (diverged: calls `convertValueFromPg` at `:76`).
- `coerceToSqlParameter`:
  - `packages/provider-mssql/src/MssqlProvider.ts:595-618` (handles HierarchyId + WKT)
  - `packages/provider-mysql/src/MySqlProvider.ts:492-511` (handles WKB only)
  - `packages/provider-postgres/src/PostgresProvider.ts:110-132` (handles ltree + EWKB hex)
- All three share the identical "primitive passthrough → JSON.stringify fallback → String fallback" core; only the leading provider-specific encoders differ.

## Why this is bad
- DRY violation across a package boundary; a bug fix (e.g. `undefined` handling — MSSQL maps `undefined→null` at `:596` but MySQL/PG do not) must be applied 3×.
- Behavioral inconsistency is already shipped: MSSQL coerces `undefined`, the others pass it through. This is a latent correctness bug, not just style.
- The private modifier blocks reuse and blocks unit testing of mapping/coercion in isolation.

## Target architecture
Composition-first: introduce two small, stateless collaborators with a clear seam for the
provider-specific encoders (Strategy):
- `EntityMapper` — `map<T>(row, entityClass, opts?): T`, applies `column.converter.fromProvider`
  then an optional provider `TypeReader` (Postgres supplies one wrapping `convertValueFromPg`).
- `ValueCoercer` — `coerce(value): SqlParameter`, composed from an ordered list of
  `ParameterEncoder` strategies (`HierarchyIdEncoder`, `GeometryEncoder`, …) plus the shared
  primitive/JSON tail.
Each provider injects only its encoder list. Place these in `@ts-linq/core` (already a shared
dependency of all three providers) or a new `@ts-linq/provider-kit` package — note the boundary
decision in the task PR. SOLID: SRP (mapping vs coercion separated), OCP (add encoder without
touching the tail), DIP (provider depends on the `ParameterEncoder` interface).

## Proposed refactor
1. Define `ParameterEncoder { matches(v): boolean; encode(v): SqlParameter }` and `TypeReader`.
2. Implement `ValueCoercer` with the shared tail and an injected encoder array.
3. Implement `EntityMapper` with an optional injected `TypeReader`.
4. Each provider constructs its encoder list (MSSQL: hierarchy+WKT; MySQL: WKB; PG: ltree+EWKB-hex)
   and a PG `TypeReader`. Remove the private methods.
5. Normalize `undefined` handling in the shared tail (decide one behavior, document it).

## Suggested design patterns
- **Strategy** — `ParameterEncoder`/`TypeReader` make per-provider encoding pluggable.
- **Composite/Chain** — ordered encoder list resolves the first matching encoder.
- **Composition over inheritance** — providers own collaborators, not inherited methods.

## Testing plan
- Unit: `ValueCoercer` with fake encoders (primitive passthrough, JSON fallback, `undefined` rule, circular-object `String` fallback).
- Unit: `EntityMapper` with a metadata fixture + a converter + a `TypeReader`.
- Provider: each provider's encoder list round-trips its spatial/hierarchy type.
- Regression: existing CRUD tests pass unchanged.

## Acceptance criteria
- [ ] Single `EntityMapper` and `ValueCoercer` implementation reused by all three providers.
- [ ] No `mapRowToEntity`/`coerceToSqlParameter` private methods remain in any provider.
- [ ] `undefined` coercion behavior is unified and documented.
- [ ] Boundary placement (core vs new package) is justified in the PR and passes `pnpm arch:deps`/`arch:cycles`.
- [ ] New unit tests cover mapper + coercer + each encoder.

## Refactor order
Land alongside `task-1.md` of each provider; can ship before full god-class decomposition.

## Notes
Cross-cutting; filed under mssql as the most-affected (it carries the extra `undefined` branch
and two encoders). See `provider-mysql/task-2.md` and `provider-postgres/task-2.md`.
