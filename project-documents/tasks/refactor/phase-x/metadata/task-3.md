---
status: completed
phase: phase-x
package: metadata
priority: P0
effort: S
risk: low
category: package-boundary
depends_on: []
related: []
decision: "Mirror clean packages — git rm 24 artifacts; rely on dist-only output (tsconfig already correct: rootDir=src, outDir=dist), no new .gitignore/tsconfig pattern"
---

# Refactor: Remove 24 committed build artifacts from `packages/metadata/src`

## Problem
`packages/metadata/src` contains 24 committed build outputs (`.d.ts`, `.d.ts.map`,
`.js.map`) interleaved with the TypeScript sources. These are git-tracked. Compiled
declaration/map files in a *source* directory are stale-by-construction, pollute diffs,
confuse `arch:dead`/`ts-prune`, and create a trap where stale `.d.ts` shadows the real
`.ts` types during tooling runs (this exact "dist stale-file trap" is recorded in the
project's own Serena memory for RF-01).

## Evidence
- `git ls-files packages/metadata/src` lists tracked artifacts including:
  `Column.d.ts`, `Column.d.ts.map`, `Column.js.map`, `Entity.d.ts(.map)`,
  `EntityMetadata.d.ts(.map)`, `EntityMetadata.js.map`, `MetadataStorage.d.ts(.map)`,
  `MetadataStorage.js.map`, `PendingMetadataCollector.d.ts(.map/.js.map)`,
  `PrimaryKey.d.ts(.map/.js.map)`, `Relationships.d.ts(.map/.js.map)`,
  `index.d.ts(.map/.js.map)` — 24 files total.
- Timestamps (Nov 20 2025) are far older than the corresponding `.ts` sources (Jun 1),
  proving they are stale relative to current code.
- No other assigned package (`types`, `core`, `ast`) has this problem — it is isolated to metadata.

## Why this is bad
- **Build reliability**: stale `.d.ts` in `src` can be picked up ahead of fresh compilation, masking type changes.
- **Tooling noise**: `ts-prune`/`madge`/dependency-cruiser may scan these and report phantom results.
- **Repo hygiene**: large, meaningless diffs; reviewers cannot trust the source tree.
- **Architectural integrity**: violates the monorepo convention that `src` holds sources only and `dist` holds outputs.

## Target architecture
`src` contains only authored `.ts`. All compiled outputs live under `dist/`. The build
tooling and `.gitignore` enforce this so artifacts cannot be re-committed.

## Proposed refactor
1. `git rm` the 24 artifacts from `packages/metadata/src` (no source `.ts` deleted).
2. Add/verify `.gitignore` entries (`*.d.ts`, `*.d.ts.map`, `*.js`, `*.js.map` under `src`, or output to `dist` only) for the package.
3. Confirm `tsconfig` `outDir` points to `dist`, not `src`, and `rootDir` is `src`.
4. Run `pnpm build` to confirm outputs land in `dist` and tooling is clean.
5. Re-run `arch:dead`/`ts-prune` to confirm phantom entries disappear.

## Suggested design patterns
- N/A (hygiene/tooling task) — but it protects every downstream refactor from the stale-file trap.

## Testing plan
- Build: `pnpm build` produces `dist` artifacts only; `src` has no generated files.
- Tooling: `arch:dead` output no longer references `src/*.d.ts`.
- CI: a check (or `.gitignore`) prevents re-adding artifacts.

## Acceptance criteria
- [x] Zero `.d.ts`/`.js`/`.map` files tracked under `packages/metadata/src`.
- [x] `.gitignore`/tsconfig prevents recurrence.
- [x] `pnpm build` + `arch:dead` clean.
- [x] No authored `.ts` source removed.

## Refactor order
Do **first** in the metadata package and ideally first in the whole cluster — it removes the
stale-file trap before any other metadata refactor edits these symbols.

## Notes
This is a `@ts-linq/metadata` (versioned) package source change but introduces no API/behaviour
change; per the changeset rules it is internal hygiene — confirm whether a `patch` changeset is
required (likely not, but verify the `Changeset present` CI rule).

## Outcome (completed)
- Removed exactly **24** generated artifacts from `packages/metadata/src` via `git rm`
  (8 stems × `.d.ts` + `.d.ts.map` + `.js.map`): `Column`, `Entity`, `EntityMetadata`,
  `MetadataStorage`, `PendingMetadataCollector`, `PrimaryKey`, `Relationships`, `index`.
  248 lines deleted, **0 additions** — pure deletion. 28 authored `.ts` sources untouched.
- **No `tsconfig`/`.gitignore` change**: `packages/metadata/tsconfig.json` was already correct
  (`rootDir: ./src`, `outDir: ./dist`); root `.gitignore` already ignores `/packages/**/dist`.
  Chose to mirror the clean `types`/`core`/`ast` convention (dist-only output) rather than
  invent a new ignore pattern — confirmed a blanket `*.js` ignore would wrongly catch the
  authored `packages/e2e-tests/src/jest-transformer.js`.
- **Recurrence prevention**: a full `clean` + `build` of `@ts-linq/metadata` emits **only** to
  `dist/` (56 `.js` + 56 `.d.ts`) and leaves `src` containing authored `.ts` only; `dist` is
  git-ignored, so outputs are uncommittable.
- **Validation (all green)**: `typecheck` 32/32, `lint` 0 errors, `test:unit` 2975 passed,
  `test:integration` 464 passed, `test:e2e` 290 passed, `build` 32/32, `arch:deps` no violations,
  `arch:cycles` none, `arch:dead` no longer references `src/*.d.ts`.
