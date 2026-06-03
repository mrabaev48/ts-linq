---
status: completed
phase: phase-x
package: metrics-safe
priority: P1
effort: S
risk: low
category: testing
depends_on: []
related: []
---

# Refactor: Replace stale/wrong test-d file with real metrics-safe type tests

## Problem

`packages/metrics-safe/test-d/index.test-d.ts` is a copy of another package's
type-test file. It imports and asserts symbols that `@ts-linq/metrics-safe` does
not export, so it provides zero type coverage for this package and would fail to
compile against the real public surface.

## Evidence

- `packages/metrics-safe/test-d/index.test-d.ts:1-4` imports `EntityId`,
  `brandId`, `unbrandId`, `PrimaryKeyOf`, `DbSet`, `Queryable`, `TypedQueryable`
  from `'..'`.
- `packages/metrics-safe/src/index.ts` only re-exports `./lib/MemoryProfiler` and
  `./lib/MetricsSafe`. A grep for `EntityId|DbSet|Queryable` in
  `packages/metrics-safe/src` returns nothing — these symbols belong to a
  different package (the branded-id / query layer).
- The actual exported surface is: `MemoryProfiler`, `MemorySample`,
  `MemoryProfilerOptions`, `safeCache`, `safeCacheSize`, `safeCacheEvicted`,
  `warnIfLoggerDebug`.

## Why this is bad

- **Dead/invalid test.** It tests nothing about metrics-safe; it is misleading
  "coverage" that may not even run (if `tsd` is not wired) or would error if it
  did.
- **Copy-paste rot.** A clear sign the file was duplicated from another package
  and never adapted — exactly the kind of inconsistency the audit must flag.

## Target architecture

A `test-d` that asserts the *real* public type surface of metrics-safe, following
the project's existing `tsd` convention. This restores meaningful type-level
coverage (Clean Code: tests describe the unit under test).

## Proposed refactor

1. Delete the imported branded-id assertions.
2. Write `expectType`-style assertions for the actual exports:
   - `safeCache(logger, { cache, hit, provider?, ttl? })` returns `void`.
   - `safeCacheSize` / `safeCacheEvicted` accept their documented payload shapes.
   - `MemoryProfiler` instance shape (`sample()` returns `Promise<MemorySample>`,
     `onSample` returns an unsubscribe `() => void`, etc.).
3. Ensure the `test-d` actually runs in CI (verify `tsd`/`test-d` wiring exists
   for this package; if not, add it or fold into the unit test run).

## Suggested design patterns

- N/A (test hygiene). Aligns with the project's type-level testing rule for
  generic/inference behaviour.

## Testing plan

- The corrected `test-d` compiles against the real exports and fails if a public
  signature changes incompatibly.
- Run alongside `packages/metrics-safe/tests/*` unit tests.

## Acceptance criteria

- [x] `test-d/index.test-d.ts` references only symbols actually exported by
      `@ts-linq/metrics-safe`.
- [x] It asserts the real signatures of `safeCache`/`safeCacheSize`/
      `safeCacheEvicted`/`MemoryProfiler`.
- [x] The type test is actually executed in the package's test/CI flow.
- [x] `pnpm typecheck` passes.

## Outcome

- Rewrote `test-d/index.test-d.ts` to import **only** the real exports
  (`safeCache`, `safeCacheSize`, `safeCacheEvicted`, `warnIfLoggerDebug`,
  `MemoryProfiler`, `MemorySample`, `MemoryProfilerOptions`) from `'..'` and
  assert their exact signatures with `tsd` (`expectType`/`expectError`/
  `expectAssignable`/`expectNotAssignable`). No `any`/casts/suppression comments;
  negatives use `expectError`. Sensitivity verified by temporarily breaking the
  `sample()` assertion (tsd failed, then reverted).
- **CI wiring (repo-wide `tsd` via Turbo):** added `"test-d": "tsd"` +
  `tsd` devDependency to `packages/metrics-safe/package.json`; a cacheable
  `test-d` Turbo task (`dependsOn: ["build", "^build"]`); a root `test-d`
  script (`turbo run test-d`); and a `Type tests (tsd)` step in
  `.github/workflows/ci.yml`. Any package opts in by adding a `test-d` script.
- The package's `tsconfig.json` (`include: ["src/**/*.ts"]`) excludes `test-d/`,
  so the negative assertions do not affect `pnpm typecheck`.
- Fixed the package docs that described a non-existent `MetricsSafe.record(...)`
  API (`README.md`, `CLAUDE.md`).
- **Tech debt found (not in scope here):** `packages/core/test-d/index.test-d.ts`
  is the same stale branded-id copy, and `packages/orm/test-d/index.test-d.ts`
  does not compile under `tsd` (composite-project file-list). They were therefore
  **not** opted into the new `test-d` wiring; recorded as follow-up.
- Validation: `pnpm -F @ts-linq/metrics-safe test-d`, `pnpm test-d`,
  `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm build`, `pnpm arch:*`,
  and `pnpm run test:all` — all green.

## Refactor order

1. Inventory real exports.
2. Rewrite assertions.
3. Confirm CI executes the file.

## Notes

Smallest, highest-certainty fix in the package — pure test hygiene with no
runtime risk.
