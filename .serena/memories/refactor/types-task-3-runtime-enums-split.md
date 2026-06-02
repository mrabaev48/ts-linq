# refactor types/task-3 — runtime vs types split (COMPLETED)

Branch: `refactor/types-runtime-vs-types-split` (stacked on `refactor-types-error-hierarchy`/task-2).

## What changed (internal reorganization of @ts-linq/types, zero public-surface change)

Two new modules under `packages/types/src/`:

- **`runtime.ts`** — the only behaviour-carrying module. Moved here: `ok`, `err` (from
  `results.ts`) and `isTemplateSqlCache` (from `cache.ts`). Type-only imports of `Result`
  (./results) and `SqlCache`/`TemplateSqlCache` (./cache).
- **`enums.ts`** — single home for all seven value-emitting enums. Moved here:
  `EntityState` (from tracking.ts), `LoadingStrategy` (from cache.ts), `ValueGeneratedPolicy`
  (from value-conversion.ts), `DeleteBehavior`/`StorageStrategy`/`InheritanceStrategy`
  (from metadata.ts), `QuerySplittingBehavior` (from sql.ts). Zero deps (leaf node).

Internal `import type { … } from './enums'` re-added where modules reference their former enums:
`cache.ts` (LoadingStrategy in LoadingDefaults), `tracking.ts` (EntityState in TrackedEntity),
`metadata.ts` (DeleteBehavior/StorageStrategy/InheritanceStrategy/ValueGeneratedPolicy).

`index.ts` barrel: added `export * from './enums'` and `export * from './runtime'`. Symbols were
MOVED (not copied), so no `export *` name collisions.

## const enum decision — REJECTED, kept regular string enums

Monorepo leaves `isolatedModules`/`preserveConstEnums`/`verbatimModuleSyntax` unset; each package
compiles separately with `declaration: true`, `module: commonjs`. Cross-package `const enum`
inlines from .d.ts but emits no runtime object (same hazard as OrmErrorCode) and breaks `export *`
+ dynamic access. All 7 enums are used as runtime values downstream (EntityState.Added,
switch(DeleteBehavior), default params) → const enum would be breaking.

## Backward-compat guarantee

Public barrel surface byte-for-byte unchanged. Guarded by `tests/type-exports.test.ts` (exact
`Object.keys(types)` manifest of 24 runtime exports) and `src/__tests__/exports.check.ts`. No
downstream package edited.

## Validation outcomes (all green)

typecheck (32 pkgs), lint (0 errors), test:unit (2964 passed), build (32 pkgs),
arch:deps (no violations), arch:cycles (none), arch:dead (none new).

## Follow-up / tech debt

Subpath exports (`@ts-linq/types/runtime`, `@ts-linq/types/enums`) deferred — possible future
enhancement (also tracked in task-1's deferred subpath-exports note).
