---
status: not-started
phase: phase-x
package: sql-visitor
priority: P2
effort: S
risk: low
category: package-boundary
depends_on: []
related: ["sql-visitor/task-1.md"]
---

# Refactor: Stop exporting internal sub-visitors and free helpers from the package barrel

## Problem
`packages/sql-visitor/src/index.ts` re-exports **every sub-visitor and several free
functions** as part of the public API:

- `BinaryVisitor, EfFunctionVisitor, FragmentJoinPlanner, HierarchyMethodVisitor, InVisitor,
  JsonPathVisitor, LogicalVisitor, MethodVisitor, NullVisitor, SpatialMethodVisitor,
  UnaryVisitor` (`index.ts:8-20`).
- Free functions `renderPropertyName`, `resolveParameterRef` (`index.ts:9`),
  `buildQuestionMarkRows`, `calcChunkSize`, `chunkArray` (`index.ts:1`),
  `isHierarchyMethod`, `isSpatialMethod` (`index.ts:12, 19`).

These are **implementation collaborators of `SqlVisitor`**, not a stable contract. Exporting
them freezes their (already inconsistent — see `sql-visitor/task-1.md`/`task-2.md`)
signatures as public API, so any visitor refactor becomes a breaking change.

## Evidence
- `packages/sql-visitor/src/index.ts:1-22` — wholesale visitor + helper exports.
- The package has **no `/internal` subpath export** (its `package.json` `exports` only
  defines `"."`), so there is nowhere "internal" for these to live — everything in the
  barrel is public.
- Only `SqlVisitor`, `ParameterStyle`/`ParameterState`, the rewriters
  (`JsonAccessRewriter`/`ComplexAccessRewriter`), the emitters
  (`CallSyntaxEmitter`/`ExecSyntaxEmitter`/`emitTagComments`/batch helpers) and the
  translator *types* are plausibly intended public surface.

## Why this is bad
- **API stability**: `sql-visitor/task-1.md` (unify visitor contract) and `task-2.md`
  (remove default state) both change visitor signatures — currently breaking changes purely
  because the visitors are exported.
- **Encourages misuse** of stateful visitors directly (the `ParameterState` default hazard,
  `task-2.md`).
- **Boundary blur**: consumers (e.g. the query package) should depend on `SqlVisitor`, not
  on `BinaryVisitor` internals.

## Target architecture
Curate the barrel: export only the **intended public API** (`SqlVisitor`, parameter style
enum/state if needed by dialect tests, rewriters, emitters, translator interface types).
Move sub-visitors + free helpers behind an `@ts-linq/sql-visitor/internal` subpath (add to
`package.json` `exports`) or keep them module-private and `@internal`-tagged.

First, **verify actual external usage**: grep the monorepo for imports of these symbols from
`@ts-linq/sql-visitor` before removing them from the public barrel.

## Proposed refactor
1. Grep all packages for `from '@ts-linq/sql-visitor'` imports; catalog which symbols are
   used externally vs only internally/in tests.
2. Add an `./internal` export subpath to `package.json` (mirroring `@ts-linq/query`).
3. Move sub-visitors + free helpers to the internal subpath; tag `@internal`.
4. Keep the public barrel minimal and named.

## Suggested design patterns
- **Curated facade barrel / Published Language** — *Why*: deliberate, minimal public
  contract enabling internal refactors.
- **Interface Segregation at package boundary** — *Why*: consumers depend on `SqlVisitor`,
  not its parts.

## Testing plan
- **Arch**: `pnpm arch:dead` / `ts-prune` shows no internal visitor leaking publicly.
- **Build**: dependent packages compile (some test imports may switch to `/internal`).
- **Contract**: public export snapshot.

## Acceptance criteria
- [ ] External usage of each currently-exported symbol catalogued.
- [ ] Sub-visitors + free helpers no longer on the public barrel (moved to `/internal` or
      made private).
- [ ] `package.json` `exports` updated if an `/internal` subpath is added.
- [ ] Export snapshot test added.
- [ ] Monorepo builds.

## Refactor order
Do the usage-grep first; then land alongside `sql-visitor/task-1.md`/`task-2.md` so the
visitor-signature changes don't count as breaking.

## Notes
If external consumers depend on sub-visitors, this becomes a `major`; otherwise the visitor
signature changes can ship as `patch`. The grep determines which.
