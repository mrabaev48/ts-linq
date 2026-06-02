---
status: completed
phase: phase-x
package: types
priority: P2
effort: S
risk: low
category: package-boundary
depends_on: ['types/task-1.md']
related: []
---

# Refactor: Separate runtime values from the pure-types package surface

## Problem
`@ts-linq/types` is presented as the zero-dependency *types* package, but `index.ts` also
ships runtime values (functions, enums, runtime type-guards). Mixing runtime exports into a
"types" package blurs the contract: consumers who only want types still pull runtime code,
and the boundary "types vs behaviour" is unclear. Some of these (enums, guards) are
legitimate, but they should be a deliberate, documented part of the surface, not scattered
through a barrel of interfaces.

## Evidence
- Runtime functions in `packages/types/src/index.ts`:
  - `ok<T>()` (line 484) and `err<E>()` (line 488) — `Result` constructors.
  - `isTemplateSqlCache()` (line 591) — runtime type guard.
- Runtime enums (emit code): `LoadingStrategy` (614), `ValueGeneratedPolicy` (676),
  `DeleteBehavior` (747), `StorageStrategy` (868), `InheritanceStrategy` (874),
  `QuerySplittingBehavior` (1134), `EntityState` (1142).
- The package name and `package.json` (`"dependencies": {}`) imply pure types, yet these emit JS.

## Why this is bad
- **Boundary clarity**: "types" package emitting runtime values is surprising; downstream type-only imports cannot use `import type` exclusively.
- **Tree-shaking**: enums (especially non-`const`) emit objects; bundlers cannot drop them if re-exported via `export *`.
- **Discoverability**: runtime helpers are buried among ~150 interface exports.

## Target architecture
Keep the runtime values (they are part of the contract) but isolate them into clearly-named
runtime modules (e.g. `runtime.ts` for `ok`/`err`/guards, `enums.ts` for enums), re-exported
from the barrel. Document which exports are runtime vs type-only. Consider `const enum`
where appropriate (weigh isolatedModules/`preserveConstEnums` constraints first). This makes
the runtime footprint explicit and intentional.

## Proposed refactor
1. Move `ok`/`err`/`isTemplateSqlCache` into `runtime.ts`; re-export.
2. Move enums into `enums.ts`; re-export.
3. Add a doc note in the package README listing the (small) runtime surface.
4. Evaluate `const enum` vs regular enum given the monorepo's `isolatedModules` setting; do not change semantics without confirming bundler support.
5. Ensure `import type { … }` continues to work for the pure-type majority.

## Suggested design patterns
- **Module segregation** — runtime vs type modules.
- **Explicit public-surface documentation** (Facade clarity).

## Testing plan
- Build: runtime values still resolve from `@ts-linq/types`.
- Bundle smoke: type-only consumers can `import type` without pulling runtime (verify emitted output).
- Regression: monorepo typecheck/build unchanged.

## Acceptance criteria
- [x] Runtime functions/guards/enums live in clearly-named modules, re-exported.
- [x] Package README documents the runtime surface.
- [x] No semantic change to enums unless `const enum` is confirmed safe.
- [x] Validations pass.

## Outcome
`ok`/`err`/`isTemplateSqlCache` moved to `src/runtime.ts`; the seven enums (`EntityState`,
`LoadingStrategy`, `ValueGeneratedPolicy`, `DeleteBehavior`, `StorageStrategy`,
`InheritanceStrategy`, `QuerySplittingBehavior`) moved to `src/enums.ts`. Both re-exported via
`export *` from the `index.ts` barrel — the public surface is byte-for-byte unchanged (verified by
`tests/type-exports.test.ts`'s exact `Object.keys` manifest and `src/__tests__/exports.check.ts`).

**`const enum` decision — rejected, regular enums kept.** The monorepo leaves `isolatedModules`,
`preserveConstEnums` and `verbatimModuleSyntax` unset; each package compiles separately with
`declaration: true`. Cross-package `const enum` inlines values from `.d.ts` while emitting no runtime
object (the same hazard that applied to `OrmErrorCode`), and breaks `export *` re-export plus dynamic
access. All seven enums are consumed as runtime values downstream (`EntityState.Added`,
`switch (DeleteBehavior)`, default parameters), so `const enum` would be a breaking change.

## Refactor order
After `types/task-1` (module split) — this is a natural continuation of that reorganization.

## Notes
This is organizational, not behavioural; keep all names exported from the barrel to avoid a
breaking change.
