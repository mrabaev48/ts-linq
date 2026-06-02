---
status: not-started
phase: phase-x
package: integration-tests
priority: P3
effort: S
risk: low
category: clean-code
depends_on: []
related: []
---

# Refactor: Remove dead directories, the no-op sequencer, and rename `tests-new`

## Problem

The package carries naming/dead-code debt: an empty `size-tests/` tree, a custom Jest
sequencer that does nothing, and a `tests-new/` directory whose name implies an unfinished
migration from a `tests-old/` that is only referenced in ignore patterns.

## Evidence

- `packages/integration-tests/size-tests/tmp` is an **empty** directory; `size-tests` is not
  referenced in `jest.config.js` or `package.json` (grep: NONE).
- `packages/integration-tests/jest.sequencer.js:1-12` — `SimpleSequencer.sort(tests)` returns
  `tests` unchanged and `cacheResults` is a pass-through; it adds indirection with no effect.
- `packages/integration-tests/jest.config.js:12,14` — `roots` point at `tests-new` and
  `testPathIgnorePatterns` still excludes `/tests-old/`, implying a half-finished rename.
- All 87 test files live under `tests-new/`, cementing a misleading directory name.

## Why this is bad

- Dead directories and no-op modules mislead readers into thinking they do something.
- `tests-new` vs `tests-old` naming signals an incomplete migration and is a code smell in a
  "production-grade" repo.
- The no-op sequencer is a maintenance liability (someone will assume it orders tests).

## Target architecture

Apply **YAGNI** + Clean Code naming: keep only artifacts that carry meaning.

- Delete `size-tests/` (or, if size tests are intended, implement and reference them).
- Remove `jest.sequencer.js` and its `testSequencer` config line, OR implement a real
  ordering policy if deterministic ordering is actually required.
- Rename `tests-new/` → `tests/` and drop the stale `/tests-old/` ignore pattern.

## Proposed refactor

1. Delete the empty `size-tests/` tree.
2. Remove `jest.sequencer.js` + `testSequencer` line in `jest.config.js` (or implement it).
3. Rename `tests-new/` → `tests/`; update `jest.config.js` `roots`, `tsconfig.json`
   `include`, and the eslint test glob (`**/tests-new/**` in `eslint-config/index.mjs:208`).
4. Remove the `/tests-old/` ignore pattern.

## Suggested design patterns

- **YAGNI / dead-code elimination** — remove unused scaffolding. WHY: less to misread.
- **Intention-revealing names** — `tests/` not `tests-new/`. WHY: clarity.

## Testing plan

- Run the integration suite after the rename to confirm `roots`/`include` still resolve.
- Confirm eslint still lints test files after updating the `tests-new` glob.

## Acceptance criteria

- [ ] `size-tests/` removed (or implemented + referenced).
- [ ] No-op sequencer removed (or replaced with a real policy).
- [ ] `tests-new/` renamed to `tests/`; all configs updated.
- [ ] `/tests-old/` ignore pattern removed; suite runs green.

## Refactor order

1. Delete dead dirs/sequencer.
2. Rename directory + update all references (jest, tsconfig, eslint glob).
3. Run suite + lint to verify.

## Notes

- The eslint test glob in `@ts-linq/eslint-config` explicitly lists `**/tests-new/**`
  (`index.mjs:208`); update it as part of the rename (see eslint-config audit).
