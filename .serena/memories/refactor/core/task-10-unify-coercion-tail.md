# core/task-10 — Unify non-dialect parameter-coercion tail (✅ Completed)

**Status:** ✅ Completed (P3, S, low-risk). Filed after core tasks 1–9, during the coercion
fail-fast sweep (`dialect-postgres/task-5`). Additive de-dup only; the in-place fail-fast fixes
already shipped earlier.

## What changed
- **New SSOT helper** `coerceParameterValue(value, property?): SqlParameter` in
  `packages/core/src/utils/coerceParameterValue.ts` — pure; deps `@ts-linq/types` **only**
  (`SqlParameter`, `ParameterCoercionError`). Tail: primitive/`null`/`Date`/`Uint8Array`
  passthrough → `bigint` → decimal `.toString()` → `JSON.stringify(value ?? null)` →
  throw `ParameterCoercionError({ cause, details: { property } })`. **No `String()` fallback.**
- Exported from curated public barrel: `core/src/utils/index.ts` (`export *`) +
  `core/src/index.ts` (`export { coerceParameterValue }`, `// Utils` section).
- `SqlHelper.ensureSqlParameter` (private static) now **delegates**: `return coerceParameterValue(value, property)`.
  Its direct `ParameterCoercionError` import removed (only `SqlParameter` remains).
- `@ts-linq/query` `SetPropertyCalls`: removed module-level `coerceToSqlParameter`; imports
  `coerceParameterValue` from `@ts-linq/core`; dropped now-unused `ParameterCoercionError` from
  the types import. `query → core` already existed — **no new package edge**.
- **Both duplicated non-dialect tails removed.** Behaviour byte-for-byte preserved.

## Architecture / boundary
- **Deliberate two-tail-by-design.** Dialect/provider layer keeps its own canonical tail
  `coerceSqlParameter` in `@ts-linq/dialect-kit`; `core`/`query` **must not** depend on
  `dialect-kit` (documented boundary + latent cycle once dialect-kit grows the shared base dialect
  in `dialect-*/task-1`). A single repo-wide tail would need a new zero-dep package below both
  layers — out of scope for an ~8-line pure fn. So: **one tail in dialect-kit** (dialects/providers
  via provider-kit), **one in core** (core + query). Boundary `core/query ↛ dialect-kit` preserved
  (only doc-comment mentions dialect-kit, not an import).

## Public surface / versioning
- `coerceParameterValue` is a **new public value export** (query can only reach it via the main
  barrel `.` — core has no internal subpath). `PublicSurface.test.ts` `EXPECTED_VALUE_EXPORTS`
  widened by one symbol. → **`@ts-linq/core` minor (3.4.8 → 3.5.0)**; **`@ts-linq/query` patch
  (4.2.2 → 4.2.3)**. Decision (minor) confirmed with user vs task's literal "patch".
- Changeset cascade: cache + composite/open-telemetry/prometheus-sql-logger declare `@ts-linq/core`
  as **peerDependency** → changesets default bumps peer-dependents **major** (12.0.8 → 13.0.0);
  orm/testkits/providers/dialects/cli/migrations got patch. Deterministic tooling output — do not
  hand-edit.

## Tests
- New `packages/core/tests-new/coerceParameterValue.test.ts` (passthrough / object→JSON /
  array→JSON / `bigint`→decimal / circular→`ParameterCoercionError` with `cause` + `details.property`
  / undefined-property path).
- Regression: `core/tests-new/SqlHelper.test.ts` + `query/tests-new/SetPropertyCalls.test.ts` pass
  **unchanged**.

## Validation (all green)
typecheck ✅ · lint ✅ (0 errors) · unit 381 suites/3916 ✅ · integration 88/461 (+2 skipped) ✅ ·
e2e 19/290 ✅ · build ✅ · arch:deps ✅ (0 violations) · arch:cycles ✅ (no cycles) · arch:dead ✅.
Branch `audit-refactor/core-unify-coercion-tail` from fresh `main`.
