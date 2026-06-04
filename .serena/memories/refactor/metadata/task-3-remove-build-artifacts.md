# metadata/task-3: Remove 24 committed build artifacts from src (done — 2026-06-04)

## What
Removed the "dist stale-file trap" (cf. `transformer/rf-01-clean-architecture`) from
`@ts-linq/metadata`: 24 generated build outputs were git-tracked inside
`packages/metadata/src`, interleaved with authored `.ts`.

## The 24 artifacts (pure deletion, 248 lines, 0 additions)
8 stems × (`.d.ts` + `.d.ts.map` + `.js.map`):
`Column`, `Entity`, `EntityMetadata`, `MetadataStorage`, `PendingMetadataCollector`,
`PrimaryKey`, `Relationships`, `index`. No plain `.js` existed. 28 authored `.ts` untouched.

Note: `git ls-files src | grep -vE '\.ts$'` UNDERCOUNTS (16) because `.d.ts` ends in `.ts`.
Real generated count = 24. Use `grep -E '\.(d\.ts|d\.ts\.map|js|js\.map)$'`.

## Recurrence prevention (decision: mirror clean packages)
- **No `tsconfig` change**: `packages/metadata/tsconfig.json` was already correct
  (`rootDir: ./src`, `outDir: ./dist`, composite/declaration/declarationMap/sourceMap).
- **No new `.gitignore`**: root `.gitignore` already ignores `/packages/**/dist`.
  Clean packages `types`/`core`/`ast` have NO package-level `.gitignore` and rely purely on
  dist-only output — mirrored that convention instead of inventing a new ignore pattern.
- Rejected a defensive `packages/**/src/**/*.js` ignore: would wrongly catch the authored
  `packages/e2e-tests/src/jest-transformer.js`. No authored `.d.ts` exists under any `src`.
- Mechanism: a full `clean` + `build` emits ONLY to `dist/` (56 `.js` + 56 `.d.ts`),
  `src` stays authored-`.ts`-only; `dist` is git-ignored ⇒ outputs uncommittable.

## Validation (all green)
typecheck 32/32; lint 0 errors; test:unit 2975; test:integration 464; test:e2e 290;
build 32/32; arch:deps no violations; arch:cycles none;
arch:dead no longer references `packages/metadata/src/*.d.ts`.

## Changeset
`@ts-linq/metadata` is `private: true` (not published) and this is internal hygiene with
no API/behaviour change ⇒ no changeset needed (verify `Changeset present` CI; add `patch`
only if CI insists). metadata is NOT in `.changeset/config.json` ignore list, but private
packages are excluded by Changesets by default.

## Refactor order
This was task-3, done FIRST in the metadata cluster (per README order) — clears the
stale-file trap before task-1 (MetadataSource port), task-2 (registry god-class split),
task-4, task-5 touch these symbols.

## Script-name gotcha
Root scripts are `test:unit` / `test:integration` / `test:e2e` / `test:all`
(NOT `tests:unit`/`tests:e2e` as CLAUDE.md §5 lists). integration/e2e use Docker Compose
and must NOT run in background (they hang).
