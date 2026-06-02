---
status: not-started
phase: phase-x
package: typescript-config
priority: P2
effort: M
risk: medium
category: typescript
depends_on: []
related: ["jest-config/task-1.md", "testkits/task-3.md"]
---

# Refactor: Modernise moduleResolution, align target/lib, and dedupe consumer overrides

## Problem

The shared base preset uses the legacy `moduleResolution: "node"` resolver, targets `ES2020`
while real consumers and the jest preset override to `ES2021`, and declares decorator settings
that consumers nonetheless re-declare locally. The result is a base preset that does not
reflect how the monorepo actually compiles, forcing every package to override it and leaving
`package.json` `exports` maps unvalidated by the type checker.

## Evidence

- `packages/typescript-config/base.json:18` — `"moduleResolution": "node"` (the classic
  resolver). It does not honour `package.json` `exports`/`imports` conditions, so a malformed
  dual CJS/ESM `exports` map (e.g. `packages/testkits/package.json:11-17`) is never caught at
  type-check time.
- `base.json:4,6` — `target: "ES2020"`, `lib: ["ES2020"]`, but consumers override to ES2021:
  `packages/integration-tests/tsconfig.json` (`target ES2021`, `lib ["ES2021","DOM"]`),
  `packages/e2e-tests/tsconfig.json` (`lib ["ES2021"]`), and the jest preset
  `packages/jest-config/index.js:8` (`lib ["ES2021","DOM"]`). The shared base does not reflect
  the de-facto target.
- Redundant decorator re-declaration: `node.json:5-6` already sets
  `experimentalDecorators` + `emitDecoratorMetadata`, yet `packages/testkits/tsconfig.json`
  and `packages/e2e-tests/tsconfig.json` extend `node.json` and still inline the same options
  (plus `target`, `lib`, `esModuleInterop`, `skipLibCheck`, `strict`, `resolveJsonModule`),
  duplicating settings the preset already provides.
- `packages/typescript-config/esm.json:5` — only flips `module` to `esnext`; it does not set a
  matching `moduleResolution` (`bundler`/`nodenext`), so the ESM build of dual-build packages
  (testkits compiles `tsconfig.json` + `tsconfig.esm.json`) resolves with the same legacy
  `node` resolver as the CJS build.

## Why this is bad

- A base preset that every consumer overrides is not a shared baseline — it is dead config
  plus per-package drift. The same target/lib is declared in 3+ places and can diverge.
- The legacy resolver cannot validate `exports`/`imports`, so packaging bugs (wrong condition,
  missing `types`) ship silently — exactly the dual-entry risk noted in the testkits audit.
- Duplicated decorator/compiler options invite skew: a package can silently drift from the
  shared decorator policy by editing its local copy.

## Why this is bad (catch-block audit)

Not applicable (config file).

## Target architecture

Apply **DRY** and **convention-over-configuration** for compiler settings, plus **resolver
modernisation**:

- Lift the de-facto target/lib (`ES2021`, with `DOM` where genuinely needed) into the shared
  base so consumers stop re-declaring it; keep only genuinely package-specific overrides.
- Move `moduleResolution` to `bundler` (or `nodenext` for true Node ESM packages) so
  `package.json` `exports` maps are validated; ensure `esm.json` sets a consistent resolver.
- Remove redundant options from consumer tsconfigs that merely repeat what `base`/`node`
  already provide.

## Proposed refactor

1. Decide the canonical target/lib (`ES2021`; add `DOM` only if a package needs it — most do
   not) and set it in `base.json`.
2. Switch `moduleResolution` to `bundler` in base; set `nodenext` only where a package is a
   real Node ESM consumer; align `esm.json`.
3. Run `pnpm typecheck` + `pnpm build` monorepo-wide; fix resolution fallout (explicit file
   extensions / `exports` corrections surfaced by the stricter resolver).
4. Strip redundant `experimentalDecorators`/`emitDecoratorMetadata`/`target`/`lib` from
   consumer tsconfigs that extend `node.json` (start with `testkits`, `e2e-tests`).
5. Add a preset-sanity fixture that extends each preset and compiles a representative file.

## Suggested design patterns

- **DRY / Single Source of Truth** — one place for target/lib/decorator policy. WHY: removes
  silent per-package drift.
- **Convention over configuration** — consumers extend and add nothing unless truly special.
  WHY: shrinks per-package tsconfigs to intent only.
- **Resolver modernisation (Adapter at the build boundary)** — `bundler`/`nodenext` validate
  `exports`. WHY: catches packaging bugs at compile time, not at publish/consume time.

## Testing plan

- `pnpm typecheck` and `pnpm build` clean monorepo-wide after the resolver/target changes.
- Preset-sanity fixtures: extend `base`/`node`/`esm`, compile a file using decorators and a
  package import, assert it resolves.
- Verify the dual-build testkits package still emits correct CJS + ESM with matching
  `exports` conditions under the new resolver.

## Acceptance criteria

- [ ] `moduleResolution` is `bundler` (or `nodenext` where appropriate) in `base.json`, and
      `esm.json` uses a consistent resolver.
- [ ] Canonical `target`/`lib` lives in the shared base; consumer tsconfigs no longer
      re-declare it unless genuinely package-specific.
- [ ] Redundant decorator/compiler options removed from `testkits` and `e2e-tests` tsconfigs.
- [ ] `package.json` `exports` maps are validated by the resolver (a deliberately broken map
      fails type-check in a fixture).
- [ ] Monorepo `pnpm typecheck` and `pnpm build` pass.

## Refactor order

1. Add preset-sanity fixtures (lock current behaviour).
2. Align target/lib in base; remove consumer duplicates.
3. Modernise `moduleResolution` in base + `esm.json`; fix fallout.
4. Validate dual-build (testkits) CJS/ESM output.

## Notes

- Coordinate target/lib flip with `jest-config` (`tsLinqTsJestConfig.tsconfig`,
  `packages/jest-config/index.js:8`) so the jest compile path matches the build path.
- The resolver switch is the riskiest step; do it after target/lib alignment so failures are
  isolated to resolution, not target changes.
