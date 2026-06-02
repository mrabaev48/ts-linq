# Refactor Audit: typescript-config

## Package responsibility

`@ts-linq/typescript-config` (`packages/typescript-config`) provides the shared tsconfig
presets consumed via `extends` across the monorepo:

- `base.json` — core compiler options (`target ES2020`, `module commonjs`, `strict`,
  declarations + maps, `moduleResolution node`).
- `node.json` — extends base, adds `experimentalDecorators` + `emitDecoratorMetadata`.
- `esm.json` — extends node, switches `module` to `esnext`.

## Current architectural problems

- **`strict: true` only; no additional safety flags.** `base.json:7` enables `strict` but the
  preset omits `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, and `noUnusedLocals`/`noUnusedParameters`. For a
  metadata-heavy ORM that indexes `columns[...]`, `paths[...]`, and `Map.get(...)` everywhere,
  `noUncheckedIndexedAccess` is the single highest-value missing flag — its absence is visible
  in `TestProvider` (`pks[0]`, `parts[1]` treated as always-defined).
- **`moduleResolution: "node"` (legacy) with `module: commonjs`.** `base.json:18` uses the
  classic `node` resolver, not `node16`/`nodenext`/`bundler`; this does not validate
  `package.json` `exports`/`imports` conditions, so a broken `exports` map (like the testkits
  dual CJS/ESM entry) won't be caught at type-check time.
- **Target/lib divergence between presets and consumers.** `base.json` targets `ES2020` with
  `lib: ["ES2020"]`, but consumers and the jest preset override to `ES2021`/`DOM`
  (`e2e-tests/tsconfig.json`, `integration-tests/tsconfig.json`,
  `jest-config/index.js:8`). The shared base does not reflect the de-facto target, so each
  package re-declares it.
- **Decorator settings split across base/node, and re-declared by consumers.** Many package
  tsconfigs extend `node.json` yet still inline `experimentalDecorators`/`emitDecoratorMetadata`
  (e.g. `testkits/tsconfig.json`, `e2e-tests/tsconfig.json`), duplicating what `node.json`
  already provides.
- **No `esm.json` consumer parity check.** `esm.json` only flips `module`; it does not set
  `moduleResolution` to a bundler/nodenext value, so ESM builds resolve with the same legacy
  `node` resolver as CJS — a latent inconsistency for the dual-build packages (testkits builds
  both via `tsconfig.json` + `tsconfig.esm.json`).

## Refactor goals

- Add high-value strictness flags (lead with `noUncheckedIndexedAccess`) on a staged ratchet.
- Modernise `moduleResolution` so `exports` maps are validated.
- Make the shared base reflect the real target (`ES2021`) so consumers stop overriding it.
- Eliminate redundant per-package decorator/target re-declarations.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Add staged strictness flags (lead: noUncheckedIndexedAccess) | P1 | Missing flags hide real index/Map bugs in an ORM |
| 2 | task-2.md — Modernise moduleResolution + align target/lib + dedupe consumer overrides | P2 | Legacy resolver, target drift, duplicated settings |

## Dependencies on other packages

- Pure dev tooling; every package extends one of these presets.
- Target/lib alignment overlaps with `jest-config` (`tsLinqTsJestConfig.tsconfig`) and the
  per-package tsconfigs across all clusters — flips must be validated monorepo-wide.

## Testing strategy

- Strictness flags are validated by `pnpm typecheck` across the monorepo; size the violation
  backlog per flag before enabling (ratchet).
- A small "preset sanity" check (extend each preset in a fixture and compile a representative
  file) guards against an invalid preset edit.

## Notes

- `base.json:13-15` enables `sourceMap` + `inlineSources` with empty `sourceRoot` — fine for
  debugging; worth confirming it is intended for published packages (source leakage into
  sourcemaps).
- The presets are otherwise correct and consistently structured (base → node → esm); the
  findings are about *strictness policy* and *resolver modernity*, not broken config.
