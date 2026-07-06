---
status: not-started
phase: phase-x
package: core
priority: P3
effort: S
risk: low
category: clean-code
depends_on: []
related: ["dialect-postgres/task-5.md", "provider-mssql/task-2.md"]
---

# Refactor: Unify the non-dialect parameter-coercion tail (SqlHelper + SetPropertyCalls)

## Problem
After the coercion fail-fast sweep, the primitive/`bigint`/JSON/throw coercion tail is now correct
but **still duplicated** in two non-dialect call sites that live outside the dialect/provider layer:
- `@ts-linq/core` — `SqlHelper.ensureSqlParameter`
- `@ts-linq/query` — the module-level `coerceToSqlParameter` in `SetPropertyCalls`

Both are behaviorally identical to each other and to the canonical `coerceSqlParameter` in
`@ts-linq/dialect-kit`, but they cannot reuse that canonical copy: `core` and `query` **must not**
depend on `@ts-linq/dialect-kit` (documented package boundary + a latent cycle once `dialect-kit`
grows the shared base dialect, `dialect-*/task-1`). So a third copy could drift again.

## Evidence
- `packages/core/src/utils/SqlHelper.ts` — `ensureSqlParameter(value, property?)` (primitive → `bigint` → JSON → throw `ParameterCoercionError`).
- `packages/query/src/SetPropertyCalls.ts` — `coerceToSqlParameter(value, property?)` (identical tail).
- Canonical (NOT reusable here due to boundary): `packages/dialect-kit/src/params/coerce.ts` `coerceSqlParameter`.

## Why this is bad
- DRY/SSOT within the non-dialect layer: two identical pure tails that must stay in lockstep.
- Drift risk: this is exactly the class of duplication that produced the original silent-corruption
  bug (dialect copies fixed first, the rest lagged).

## Target architecture
Extract a single pure helper — e.g. `coerceParameterValue(value, property?): SqlParameter` — into
`@ts-linq/core` (deps: `@ts-linq/types` only for `SqlParameter` + `ParameterCoercionError`). Have
`SqlHelper.ensureSqlParameter` and `query`'s `SetPropertyCalls` both delegate to it. `query` already
depends on `core` (`query → core`), so no new edge or cycle is introduced.

This deliberately does **not** attempt to also unify the dialect-kit tail: `core` cannot depend on
`dialect-kit`. The repo therefore keeps **two** canonical tails by design — one in `dialect-kit`
(consumed by dialects and, via `provider-kit`, by providers — see `provider-mssql/task-2.md`) and
one in `core` (consumed by `core` + `query`). A single repo-wide tail would require hoisting it into
a new zero-dependency package below both layers; that is out of scope and not currently justified for
an ~8-line pure function.

## Proposed refactor
1. Add `coerceParameterValue(value, property?)` in `@ts-linq/core` (pure; throws `ParameterCoercionError`; renders `bigint`).
2. `SqlHelper.ensureSqlParameter` → delegate to it.
3. `SetPropertyCalls`'s literal coercion → delegate to it (import from `@ts-linq/core`).
4. Remove the two duplicated tails.

## Suggested design patterns
- **SSOT / Extract Function** — one pure coercion tail for the non-dialect layer.

## Testing plan
- Unit: `coerceParameterValue` — primitive passthrough, plain object → JSON, `bigint` → decimal string, circular → throws `ParameterCoercionError` (cause + `details.property`).
- Regression: existing `SqlHelper.test.ts` and `SetPropertyCalls.test.ts` pass unchanged.

## Acceptance criteria
- [ ] One `coerceParameterValue` in `@ts-linq/core`, reused by `SqlHelper` and `query`'s `SetPropertyCalls`.
- [ ] No duplicated primitive/JSON coercion tail remains in `core`/`query`.
- [ ] Fail-fast behavior (`ParameterCoercionError`, no `String()`) preserved; happy path unchanged.
- [ ] `pnpm arch:deps`/`arch:cycles` pass — no new package edge beyond the existing `query → core`.

## Refactor order
Low priority; independent. Ship any time. Not a prerequisite for `provider-*/task-2` (that path uses
the `dialect-kit` tail via `provider-kit`).

## Notes
Follow-up discovered during the coercion fail-fast sweep (see `dialect-postgres/task-5.md`). The
in-place fail-fast fixes already shipped; this task only removes the residual duplication and is
optional. `core`'s tasks 1–9 are complete; this is a newly-filed P3 follow-up.
