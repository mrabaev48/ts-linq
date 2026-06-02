# Refactor Audit: jest-config

## Package responsibility

`@ts-linq/jest-config` (`packages/jest-config`) is the shared Jest configuration factory. It
exports `createJestConfig` (root/all-package runs) and `createPackageJestConfig` (per-package
runs), plus the shared `tsLinqModuleNameMapper`, `tsLinqTsJestConfig`, and a `jest-transformer.js`
ts-jest AST adapter that wires `@ts-linq/transformer` into compilation.

## Current architectural problems

- **Hand-maintained 30+ entry alias map that has drifted.** `tsLinqTsJestConfig.paths`
  (`index.js:14-46`) and `tsLinqModuleNameMapper` (`:50-82`) are two parallel manually-curated
  lists of every workspace package. They include a **stale `@ts-linq/config` mapping**
  (`:28,64`) for a package that **does not exist**, and **omit `@ts-linq/transformer`** (and
  `@ts-linq/cli`) — even though the transformer is loaded by the AST adapter. The catch-all
  per-package mapper (`:118-121`) proves a generic mapping is feasible, making the root list's
  manual enumeration pure drift risk.
- **Two near-duplicate path lists.** The `paths` object and the `moduleNameMapper` object encode
  the same package→src mapping twice in different syntaxes; they must be kept in sync by hand.
- **Brittle ts-jest internals access in the transformer adapter.** `jest-transformer.js:9-16`
  reaches into `tsCompiler._languageService` (a private ts-jest field); a ts-jest upgrade can
  break query rewriting silently. This adapter is also duplicated in `e2e-tests` (see
  e2e-tests/task-1).
- **The transformer requires built `dist`.** `jest-transformer.js:5` does
  `require('../transformer/dist/index.js')` — tests fail opaquely if `@ts-linq/transformer`
  isn't built first; there's no guard or clear error (the RF-01 memory notes a "dist stale-file
  trap").
- **No exported, resolvable path for the adapter**, forcing consumers (e2e) to copy it.

## Refactor goals

- Replace the two hand-curated alias lists with a single generated mapping (or rely on the
  catch-all), removing the stale `config` entry and the missing `transformer`/`cli` entries.
- Make the transformer adapter exportable from this package so no consumer copies it.
- Harden the adapter: fail loudly if the transformer `dist` is missing/stale; isolate the
  private-internals access behind one documented seam.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Generate/unify the module alias maps; fix stale+missing entries | P1 | Stale `config`, missing `transformer`; double-maintained lists |
| 2 | task-2.md — Export + harden the AST transformer adapter | P1 | Copied into e2e; brittle private-internals + dist trap |

## Dependencies on other packages

- Consumed by root `jest.config.js`, `integration-tests`, `e2e-tests`, and per-package configs.
- The adapter depends on `@ts-linq/transformer` (built `dist`).
- task-2 is the upstream of e2e-tests/task-1 (which removes the e2e copy).

## Testing strategy

- A unit test asserting the generated alias map covers exactly the existing workspace packages
  (no stale entries, no omissions) — driven from `pnpm-workspace`/the `packages/*` listing.
- A smoke test that compiles a `.where(lambda)` through the adapter and asserts the rewrite,
  plus a test asserting a clear error when the transformer `dist` is absent.

## Notes

- `createJestConfig` `testPathIgnorePatterns` (`:92`) and the integration config both still
  ignore `/tests-old/` — stale, tied to the integration-tests `tests-new` naming debt.
- `tsLinqTsJestConfig.tsconfig` inlines `experimentalDecorators`/`emitDecoratorMetadata`
  (`:10-11`) rather than extending `@ts-linq/typescript-config/node.json`, duplicating compiler
  settings that already live in the shared tsconfig (see typescript-config audit).
