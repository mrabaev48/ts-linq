---
status: not-started
phase: phase-x
package: _shared
priority: P1
effort: S
risk: medium
category: package-boundary
depends_on: []
related: ["plugin-audit/task-3.md", "plugin-soft-delete/task-3.md", "plugin-multi-tenant/task-3.md"]
---

# Refactor: Fix broken ESM build across plugins

## Problem

Every plugin advertises an ESM entry point and an `import` export condition that point to a file the
build never produces.

## Evidence

For `plugin-audit`, `plugin-soft-delete`, `plugin-multi-tenant` (`package.json`):

- `"module": "./dist/index.esm.js"`
- `"exports": { ".": { "import": "./dist/index.esm.js", "require": "./dist/index.js" } }`
- but `"build": "tsc -p tsconfig.json"` (CJS only). e.g. `plugin-audit/package.json:6,11-13,17`.

Each package *has* a `tsconfig.esm.json` (e.g. `packages/plugin-audit/tsconfig.esm.json`) that is
never invoked by `build`. Contrast `integration-nestjs`/`examples` whose build *does* run both
(`"build": "tsc -p tsconfig.json && tsc -p tsconfig.esm.json"`).

## Why this is bad

- Any ESM consumer (`import { AuditMiddleware } from '@ts-linq/plugin-audit'`) resolves the `import`
  condition to a missing `dist/index.esm.js` → runtime module-not-found.
- The packages are `private: true` today so it is latent, but it is a publish-blocking landmine and a
  silent inconsistency with the rest of the monorepo's dual-build convention.

## Target architecture

Uniform dual-build convention across all publishable/library packages. Single Responsibility for the
build script: emit exactly the artifacts the `exports` map promises. Prefer **consistency** with the
already-correct `integration-nestjs` build line.

## Proposed refactor

1. Change each plugin `build` to `tsc -p tsconfig.json && tsc -p tsconfig.esm.json`.
2. Verify `tsconfig.esm.json` outputs `dist/index.esm.js` (filename/`outDir` consistent with `module`).
3. Add a build smoke check (see testing plan).
4. Audit whether the monorepo should instead standardise on a bundler (tsup/unbuild) for all
   library packages — record as a follow-up if out of scope.

## Suggested design patterns

- N/A (build hygiene). Principle: **single source of truth** between `exports` map and build outputs.

## Testing plan

- Post-build assertion (CI or test) that `dist/index.esm.js`, `dist/index.js`, `dist/index.d.ts`
  all exist for each plugin.
- `node --input-type=module -e "import('@ts-linq/plugin-audit')"` smoke import (once unprivated or via
  workspace resolution).

## Acceptance criteria

- [ ] All three plugin `build` scripts emit both CJS and ESM.
- [ ] `dist/index.esm.js` exists after build for each plugin.
- [ ] The `exports.import` target resolves to a real file.
- [ ] Build outputs match the `main`/`module`/`types` fields.

## Refactor order

1. Verify `tsconfig.esm.json` filenames. 2. Update build scripts. 3. Add smoke assertion.

## Notes

Gate on `_shared/task-1`: retired plugins skip this. Pure config; low logic risk but `risk: medium`
because a wrong `outFile`/`outDir` could clobber the CJS build.
