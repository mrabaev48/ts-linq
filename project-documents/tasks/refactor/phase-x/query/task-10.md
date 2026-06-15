---
status: completed
phase: phase-x
package: query
priority: P2
effort: M
risk: medium
category: package-boundary
depends_on: []
related: []
---

# Refactor: Tighten the `@ts-linq/query` public API surface (`@internal` discipline + barrel hygiene)

## Problem
The main barrel `packages/query/src/index.ts` re-exports implementation collaborators with
`export *`, freezing internal classes into the stable public contract:

- `export * from './Queryable'` (`index.ts:14`) re-exports **everything** in Queryable.ts,
  including the `OrderedQueryable._fromQueryable` static, and (transitively) the
  module-level `extractKey` is *not* exported only because it lacks `export` — but the
  `export *` pattern means any future incidental `export` leaks.
- `export * from './QueryBuilder'` (`index.ts:15`) exposes the entire `QueryBuilder` class
  including deprecated no-op statics and cache internals.
- `export * from './QueryModel'` (`index.ts:16`) and `export * from './TypedQueryable'`
  (`index.ts:20`) similarly export wholesale.
- `LruCache` + `LruCacheOptions` are exported from the **main** barrel (`index.ts:12-13`),
  yet `LruCache` is also (correctly) an internal cache layer; it appears in both the public
  and `internal` surfaces.

Meanwhile the `internal` barrel (`packages/query/src/internal/index.ts`) is the *intended*
home for implementation details and is properly commented `@internal`, but several genuinely
internal types still escape via the main barrel.

## Evidence
- `index.ts:12-20` — `export *` for Queryable, QueryBuilder, QueryModel, TypedQueryable;
  explicit `LruCache`/`LruCacheOptions` export.
- `internal/index.ts:1-12` — the parallel `@internal` barrel re-exporting CountCache,
  EnhancedSqlCache, FallbackManager, IncludePlanner, PaginationBuilder, RowMaterializer,
  TtlCacheDecorator, MetricsCacheDecorator — confirming these are *meant* to be internal.
- `RowMaterializer` is tagged `/** @internal */` (`RowMaterializer.ts:5`) yet reachable
  through the internal barrel only (good) — but `QueryBuilder` (with cache internals) is on
  the **main** barrel (not good).

## Why this is bad
- **API stability risk**: `export *` means refactors (e.g. `query/task-7.md` splitting
  `QueryBuilder`) become *breaking changes* because the whole class is public.
- **Discoverability noise**: consumers see deprecated statics and cache internals in
  autocomplete.
- **No `@internal` enforcement**: nothing distinguishes "stable contract" from "incidental
  export," so `ts-prune`/api-extractor can't guard drift.

## Target architecture
Apply **explicit, curated barrels** + `@internal` discipline (Interface Segregation at the
package boundary):
- Main barrel re-exports only the *intended* public API with **named** exports (no
  `export *`).
- Everything else moves behind `@ts-linq/query/internal` (already exists) and is tagged
  `@internal`.
- Deprecated `QueryBuilder` statics are removed (see `query/task-7.md`) before/with this.

## Proposed refactor
1. Replace `export *` with explicit named exports for the public types
   (`Queryable`, `OrderedQueryable`, `TypedQueryable`, `QueryModel` if public, the EF
   helpers, error types).
2. Move `QueryBuilder` to the internal barrel (or expose only a minimal public interface) —
   coordinate with `query/task-7.md`.
3. Remove `LruCache`/`LruCacheOptions` from the main barrel (keep on internal).
4. Add `@internal` JSDoc to all internal collaborators and run `ts-prune`/`arch:dead` to
   confirm no unintended public symbols remain.

## Suggested design patterns
- **Published Language / curated facade barrel** — *Why*: the package's public contract is
  deliberate and minimal, enabling internal refactors without breaking consumers.
- **Interface Segregation at package boundary** — *Why*: consumers depend only on what they
  use.

## Testing plan
- **Contract**: snapshot the resolved public export list; assert internals are absent.
- **Arch**: `pnpm arch:dead` / `ts-prune` shows no internal symbol leaking through the main
  barrel.
- **Build**: downstream packages (orm, etc.) still resolve their imports (some may need to
  switch to `@ts-linq/query/internal`).

## Acceptance criteria
- [ ] No `export *` in `packages/query/src/index.ts`.
- [ ] `QueryBuilder` cache internals + deprecated statics not on the public barrel.
- [ ] `LruCache` removed from the main barrel.
- [ ] All internal collaborators tagged `@internal`.
- [ ] Export snapshot test added.

## Refactor order
Coordinate with `query/task-7.md` (QueryBuilder split). Audit downstream importers first.

## Notes
Moving symbols off the public barrel is a `major` change; bundle with the other public-API
changes to amortize one major bump.
