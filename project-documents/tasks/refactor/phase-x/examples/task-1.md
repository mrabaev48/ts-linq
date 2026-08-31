---
status: done
phase: phase-x
package: examples
priority: P2
effort: M
risk: low
category: testing
depends_on: []
related: ["integration-nestjs/task-1.md"]
---

# Refactor: Populate runnable examples (as public-API smoke tests) or remove the package

## Problem

`@ts-linq/examples` is an empty placeholder that is compiled but never executed, and it masks a real
gap: there is no consumer-facing example that imports the public ORM entry points and runs them the way
an end user would.

## Evidence

- `packages/examples/src/index.ts:1-5` — stub only (`export const placeholder = 'examples';`).
- `packages/examples/package.json:16-20` — `build`/`clean`/`typecheck` scripts only; no `start`/`example`
  script and no executable entry point, so nothing here actually runs.
- `package.json` declares no runtime dependency on `@ts-linq/orm`/provider — it cannot demonstrate the
  ORM even if populated as-is.
- Committed `packages/examples/tsconfig.tsbuildinfo` (build noise).

## Why this is bad

- **Placeholder-as-documentation:** implies usage examples exist when they do not.
- **Hidden coverage gap:** no smoke test exercises the *public* surface (`import { DbContext } from
  '@ts-linq/orm'`, define an entity, query) — regressions in the consumer entry points would not be
  caught by package-internal unit tests.
- Dead, never-run compiled artifact.

## Target architecture

Either:

- **Populate** with a small set of runnable examples that double as CI-executed public-API smoke tests:
  add `@ts-linq/orm` + an in-memory/test provider as deps, add example scripts each with an `npm run`
  entry, and run them in CI so a broken public export fails the build. Apply "examples are executable
  documentation".
- **Remove** the package if e2e/integration suites already cover the public entry points and examples
  belong in docs instead.

## Proposed refactor

1. Decide populate vs remove (coordinate with `integration-nestjs/task-1` for a coherent package list).
2. If populate: add deps, write 3-5 focused examples (CRUD, query/LINQ, transactions, one plugin usage),
   add run scripts, wire into CI as smoke tests.
3. If remove: delete the package, scrub references, gitignore `*.tsbuildinfo`.

## Suggested design patterns

- N/A (governance + test strategy). Principle: **executable documentation / smoke testing the public
  contract**.

## Testing plan

- Populate: each example runs in CI against an in-memory/test provider and exits 0; a deliberately
  broken public export must fail an example.
- Remove: confirm no importers; workspace builds without it.

## Acceptance criteria

- [x] Decision recorded (populate / remove) — **populate**.
- [x] If populated: at least one runnable example per major public capability, executed in CI
      (`crud.ts`, `linq-queries.ts`; run in `.github/workflows/e2e.yml`).
- [ ] If removed: package gone, references scrubbed, `*.tsbuildinfo` gitignored. — N/A (populated).
- [x] No empty `placeholder` export remains.

## Refactor order

1. Decision. 2. Execute. 3. CI wiring (if populate) / cleanup (if remove).

## Notes

Recommend populate: it is the cheapest way to gain a real public-API regression guard.
