---
status: not-started
phase: phase-x
package: jest-config
priority: P1
effort: M
risk: medium
category: architecture
depends_on: []
related: ["e2e-tests/task-1.md"]
---

# Refactor: Export and harden the ts-jest AST transformer adapter

## Problem

The ts-jest AST adapter that wires `@ts-linq/transformer` into compilation reaches into
private ts-jest internals, fails opaquely if the transformer `dist` is missing, and is not
exported in a way consumers can reference — so `e2e-tests` keeps a verbatim copy. This is
compiler-critical glue (it performs the `.where(lambda)` rewrite) with the least robustness.

## Evidence

- `packages/jest-config/jest-transformer.js:9-16` — `getProgram` reads
  `tsCompiler._languageService.getProgram()`, a **private** ts-jest field; a ts-jest upgrade
  can change this and silently disable the rewrite.
- `:5` — `require('../transformer/dist/index.js')` with `mod.default || mod`; if the
  transformer is unbuilt or stale, the require fails/returns the wrong shape with no actionable
  message (the RF-01 memory documents a "dist stale-file trap").
- `packages/e2e-tests/src/jest-transformer.js:1-29` — a near-identical copy that exists only
  because there is no shared, resolvable export of this adapter (see e2e-tests/task-1).
- The package barrel (`index.js:128-133`) exports configs but **not** the transformer path,
  forcing consumers to hard-code relative paths to it.

## Why this is bad

- A single fragile access to private internals is duplicated, doubling the breakage surface of
  the most important compile-time integration in the repo.
- An unbuilt transformer produces a confusing failure instead of a clear "build
  @ts-linq/transformer first" error.
- No exported path means the duplication in e2e cannot be removed cleanly.

## Why this is bad (catch-block audit)

No catch block; but the silent-failure modes (private-internals change, missing dist) behave
like swallowed errors — the rewrite stops applying with no clear signal.

## Target architecture

Apply **Adapter (single instance)** + **fail-fast**:

- Make the adapter a first-class export of `@ts-linq/jest-config` (export a resolvable path or
  a `createTsLinqAstTransformer()` helper), so all consumers — including e2e — reference one
  module.
- Isolate the private `_languageService` access behind one small, documented function with a
  guarded fallback and a clear error if no `Program` can be obtained.
- Validate the transformer module shape on load and throw a precise, actionable error if the
  `dist` is missing/stale.

## Proposed refactor

1. Export the adapter (path and/or factory) from `index.js`; add it to `files`.
2. Add a guard that throws `Cannot load @ts-linq/transformer dist — run its build first` when
   the require fails or the export shape is wrong.
3. Wrap the `_languageService` access with a documented comment and a defined fallback order.
4. Point `e2e-tests` at the exported adapter and delete its copy (e2e-tests/task-1).
5. Add a smoke test compiling `.where(x => x.id === 1)` and asserting the rewrite.

## Suggested design patterns

- **Adapter** — one ts-jest ↔ transformer bridge. WHY: single upgradeable seam for fragile
  internals.
- **Fail-fast guard** — clear error on missing dist. WHY: turns opaque failures into fixable
  ones.

## Testing plan

- Smoke test: a `.where(lambda)` compiles to the rewritten parameterised form through the
  shared adapter.
- Negative test: simulate a missing transformer dist and assert the actionable error.

## Acceptance criteria

- [ ] The adapter is exported/resolvable from `@ts-linq/jest-config`.
- [ ] Missing/stale transformer dist yields a clear, actionable error.
- [ ] Private-internals access is isolated behind one documented function.
- [ ] e2e references the shared adapter (its copy removed via e2e-tests/task-1).
- [ ] Smoke test proves the rewrite still applies.

## Refactor order

1. Export + guard in jest-config.
2. Add smoke + negative tests.
3. Remove the e2e copy (e2e-tests/task-1).

## Notes

- Upstream of e2e-tests/task-1; land the export here first.
