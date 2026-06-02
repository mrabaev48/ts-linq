---
status: not-started
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

- [ ] `test-d/index.test-d.ts` references only symbols actually exported by
      `@ts-linq/metrics-safe`.
- [ ] It asserts the real signatures of `safeCache`/`safeCacheSize`/
      `safeCacheEvicted`/`MemoryProfiler`.
- [ ] The type test is actually executed in the package's test/CI flow.
- [ ] `pnpm typecheck` passes.

## Refactor order

1. Inventory real exports.
2. Rewrite assertions.
3. Confirm CI executes the file.

## Notes

Smallest, highest-certainty fix in the package — pure test hygiene with no
runtime risk.
