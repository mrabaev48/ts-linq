---
status: not-started
phase: phase-x
package: e2e-tests
priority: P1
effort: S
risk: medium
category: package-boundary
depends_on: []
related: ["jest-config/task-2.md"]
---

# Refactor: De-duplicate the AST transformer adapter

## Problem

The ts-jest AST transformer adapter that wires `@ts-linq/transformer` into compilation exists
in **two near-identical copies**. This is compiler-critical glue — if the two copies drift,
e2e and the rest of the monorepo can apply different (or no) `.where(lambda)` rewriting, and
the divergence is invisible until a query silently fails to translate.

## Evidence

- `packages/e2e-tests/src/jest-transformer.js:1-29` and
  `packages/jest-config/jest-transformer.js:5-32` are the same `getProgram` + `factory`
  implementation. The only difference is the relative require path:
  `'../../transformer/dist/index.js'` (e2e) vs `'../transformer/dist/index.js'` (jest-config).
- `packages/e2e-tests/jest.config.js:16-20` points `astTransformers.before` at the local
  `<rootDir>/src/jest-transformer.js` copy instead of the shared one.

## Why this is bad

- Two sources of truth for compiler glue: a fix to `getProgram` (e.g. a ts-jest internals
  change) must be applied twice or e2e silently regresses.
- DRY/SRP violation: the transformer wiring is an infrastructure concern that belongs in one
  place (`@ts-linq/jest-config`), not duplicated into a test package.
- The brittle `tsCompiler._languageService` access (private ts-jest internals) is now
  duplicated, doubling the maintenance surface for an already fragile integration.

## Why this is bad (catch-block audit)

No catch blocks; the issue is duplicated critical infrastructure.

## Target architecture

Apply **DRY + single source of truth** and **Adapter**:

- `@ts-linq/jest-config` exports the transformer adapter (it already owns
  `jest-transformer.js`). e2e references that exported path instead of a local copy.
- The private-internals access (`_languageService`) lives in exactly one place behind a small,
  documented adapter so a future ts-jest upgrade is a one-file change.

## Proposed refactor

1. Expose the adapter from `@ts-linq/jest-config` (e.g. add to `files` and provide a resolved
   path/helper, or export `jestTransformerPath`).
2. Point `e2e-tests/jest.config.js` `astTransformers.before` at the shared module.
3. Delete `packages/e2e-tests/src/jest-transformer.js`.
4. Add a single smoke test proving `.where(lambda)` rewriting applies in e2e.

## Suggested design patterns

- **Adapter (single instance)** — one ts-jest ↔ transformer bridge. WHY: isolates fragile
  private-internals access to one upgradeable place.
- **Single Source of Truth** — WHY: kills silent drift between copies.

## Testing plan

- A focused e2e smoke test that compiles a `.where(x => x.id === 1)` and asserts the rewritten
  parameterised SQL/behaviour, proving the shared adapter is active.

## Acceptance criteria

- [ ] Only one transformer adapter module exists in the repo.
- [ ] `e2e-tests/jest.config.js` references the shared adapter.
- [ ] `packages/e2e-tests/src/jest-transformer.js` deleted.
- [ ] A smoke test confirms `.where(lambda)` rewriting works in e2e.

## Refactor order

1. Export adapter from jest-config (jest-config/task-2).
2. Repoint e2e config; delete the copy.
3. Add smoke test.

## Notes

- Coordinate with jest-config/task-2, which owns making the adapter exportable.
