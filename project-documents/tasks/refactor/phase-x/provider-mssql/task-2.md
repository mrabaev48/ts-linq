---
status: not-started
phase: phase-x
package: provider-mssql
priority: P1
effort: L
risk: medium
category: architecture
depends_on: []
related: ["provider-mysql/task-2.md", "provider-postgres/task-2.md", "dialect-postgres/task-5.md", "core/task-10.md"]
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
- All three share the identical "primitive passthrough → JSON.stringify fallback" core; only the leading provider-specific encoders differ.

> **Fail-fast already shipped — do NOT reintroduce the silent `String()` fallback.** The historic
> `catch { return String(value) }` tail (which bound a corrupt `"[object Object]"` parameter with
> no diagnostic) has already been removed everywhere: the canonical shared tail in
> `@ts-linq/dialect-kit` `coerceSqlParameter` now throws a typed `ParameterCoercionError`
> (`dialect-postgres/task-5`), and the three provider private methods were brought in line by the
> coercion fail-fast sweep. This task **consolidates** the (now-correct) copies — it is no longer a
> behavior change on the fallback path. The `ValueCoercer` tail must **delegate** to the canonical
> `coerceSqlParameter` and must never fall back to `String(value)`.

## Why this is bad
- DRY violation across a package boundary; a change (e.g. `undefined` handling — MSSQL maps `undefined→null` at `:596` but MySQL/PG do not) must be applied 3×.
- Behavioral inconsistency is already shipped: MSSQL coerces `undefined`, the others pass it through. This is a latent correctness bug, not just style.
- The private modifier blocks reuse and blocks unit testing of mapping/coercion in isolation.

## Target architecture
Composition-first: introduce two small, stateless collaborators with a clear seam for the
provider-specific encoders (Strategy):
- `EntityMapper` — `map<T>(row, entityClass, opts?): T`, applies `column.converter.fromProvider`
  then an optional provider `TypeReader` (Postgres supplies one wrapping `convertValueFromPg`).
- `ValueCoercer` — `coerce(value, property?): SqlParameter`, composed from an ordered list of
  `ParameterEncoder` strategies (`HierarchyIdEncoder`, `GeometryEncoder`, …). When no encoder
  matches, it **delegates the primitive/bigint/JSON tail to `coerceSqlParameter` from
  `@ts-linq/dialect-kit`** — the single canonical, already fail-fast implementation — passing
  `property` through so a non-serializable value throws `ParameterCoercionError` with identifier
  context. The tail is never re-implemented and never degrades to `String(value)`.

**Boundary decision (was open; now decided):** place `EntityMapper`/`ValueCoercer` and the encoder
interfaces in a **new `@ts-linq/provider-kit`** package, **not** `@ts-linq/core`. Rationale: the
canonical coercion tail lives in `@ts-linq/dialect-kit`, and the collaborators must reuse it rather
than fork a fourth copy. `core` **must not** depend on `dialect-kit` (documented boundary + a latent
cycle once `dialect-kit` grows the shared base dialect, `dialect-*/task-1`). `provider-kit` sits
above the dialect layer — every provider already depends on its dialect (`dialect-* → dialect-kit`)
— so `provider-kit → dialect-kit` is directionally correct and acyclic. `provider-kit` deps:
`core`, `types`, `metadata`, `dialect-kit`. SOLID: SRP (mapping vs coercion separated), OCP (add
encoder without touching the tail), DIP (provider depends on the `ParameterEncoder` interface).

## Proposed refactor
1. Create `@ts-linq/provider-kit` (deps: `core`, `types`, `metadata`, `dialect-kit`).
2. Define `ParameterEncoder { matches(v): boolean; encode(v): SqlParameter }` and `TypeReader`.
3. Implement `ValueCoercer` = run the injected encoder chain, then delegate the tail to
   `coerceSqlParameter(value, property)` from `@ts-linq/dialect-kit` (fail-fast; throws
   `ParameterCoercionError`, renders `bigint`). No local primitive/JSON tail, no `String()` fallback.
4. Implement `EntityMapper` with an optional injected `TypeReader`.
5. Each provider constructs its encoder list (MSSQL: hierarchy+WKT; MySQL: WKB; PG: ltree+EWKB-hex)
   and a PG `TypeReader`. Remove the private `mapRowToEntity`/`coerceToSqlParameter` methods.
6. Normalize `undefined` handling in the collaborator (decide one behavior, document it) — note the
   `undefined→null` prefix is an encoder/guard concern, distinct from the fail-fast serialization tail.

## Suggested design patterns
- **Strategy** — `ParameterEncoder`/`TypeReader` make per-provider encoding pluggable.
- **Composite/Chain** — ordered encoder list resolves the first matching encoder.
- **Composition over inheritance** — providers own collaborators, not inherited methods.

## Testing plan
- Unit: `ValueCoercer` with fake encoders (encoder match wins; primitive passthrough; plain object → JSON via the delegated tail).
- Unit: tail behavior via the coercer — `bigint` → decimal string; a circular reference → **throws `ParameterCoercionError`** (cause + identifier context), never `"[object Object]"`.
- Unit: `EntityMapper` with a metadata fixture + a converter + a `TypeReader`.
- Provider: each provider's encoder list round-trips its spatial/hierarchy type.
- Regression: existing CRUD tests pass unchanged (fail-fast tail already in effect pre-consolidation).

## Acceptance criteria
- [ ] Single `EntityMapper` and `ValueCoercer` implementation reused by all three providers, living in the new `@ts-linq/provider-kit`.
- [ ] `ValueCoercer` delegates its serialization tail to `@ts-linq/dialect-kit` `coerceSqlParameter` (fail-fast, throws `ParameterCoercionError`); **no `String(value)` fallback and no re-implemented tail**.
- [ ] No `mapRowToEntity`/`coerceToSqlParameter` private methods remain in any provider.
- [ ] `undefined` coercion behavior is unified and documented.
- [ ] `@ts-linq/provider-kit` (deps incl. `dialect-kit`) passes `pnpm arch:deps`/`arch:cycles` — no new cycle, `core` still does not depend on `dialect-kit`.
- [ ] New unit tests cover mapper + coercer + each encoder + the fail-fast tail assertions.

## Refactor order
Land alongside `task-1.md` of each provider; can ship before full god-class decomposition. Introduces
`@ts-linq/provider-kit`, consumed by all three providers' `task-2`.

## Notes
Cross-cutting; filed under mssql as the most-affected (it carries the extra `undefined` branch
and two encoders). See `provider-mysql/task-2.md` and `provider-postgres/task-2.md`.
