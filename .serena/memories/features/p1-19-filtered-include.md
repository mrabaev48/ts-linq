# P1-19 Filtered Include — Implementation Notes

## Status
Completed. Branch: `feat/p1-19-filtered-include`. PR pending.

## What was implemented

EF Core-style filtered includes: `where/orderBy/orderByDescending/thenBy/thenByDescending/skip/take`
operators inside `include()` lambdas, applied in-memory per parent entity after fetching all related rows.

### Architecture — no circular dependency
`FilteredIncludeSpec` interface lives in `@ts-linq/types` (no deps).
Both `@ts-linq/core` (EntityLoader) and `@ts-linq/query` (IncludeSubquery) depend on it.

### New files
- `packages/query/src/include/IncludeSubquery.ts` — fluent immutable builder implementing `FilteredIncludeSpec`
  - `applyFilter(items)` does in-memory filter → sort → skip → take
  - `select/groupBy/join()` throw with helpful message (forbidden in include)
  - `NavigationProxy<T>` mapped type: maps nav props → `IncludeSubquery<ElementType>`

### Modified files
- `packages/types/src/index.ts` — added `FilteredIncludeSpec` interface
- `packages/core/src/loading/EntityLoader.ts` — added `populateFilteredRelationshipsMany(entities, entityClass, specs: Map<string, FilteredIncludeSpec>)`
  - fetches all related rows via `findWhereIn`, groups by FK, calls `spec.applyFilter` per parent
  - one-to-many only; silently skips other relationship types
- `packages/query/src/IncludePlanner.ts` — `populateIncludes()` accepts optional `filteredIncludes?: Map<string, FilteredIncludeSpec>`; processes filtered includes first, then skips their keys in regular batch loading
- `packages/query/src/QueryExecutor.ts` — `filteredIncludes` threaded through `executeAndMaterialize`, `handlePrimaryRows`, `handleFallbackEntities`, `tryFallbackSelectSequential`
- `packages/query/src/Queryable.ts` — three-overload `include()`:
  1. `include(key: K)` — string key
  2. `include(selector: (e: T) => T[K])` — plain lambda (extractKey proxy)
  3. `include(selector: (e: NavigationProxy<T>) => IncludeSubquery<U>)` — filtered lambda
  Runtime detection: proxy returns `IncludeSubquery` instances; `instanceof` check routes to filtered path.
  `_filteredIncludes: Map<string, IncludeSubquery<unknown>>` field; propagated in `clone()`.
- `packages/orm/src/DbSet.ts` — `include()` updated to expose same three overloads; implementation casts to `any` to delegate to `Queryable.include()`
- `packages/query/src/index.ts` — exports `IncludeSubquery` and `NavigationProxy`

### Tests
- `packages/query/tests-new/filteredInclude.test.ts` — 37 unit tests (manual stubs, no vi)
- `packages/integration-tests/tests-new/07-advanced-features/filteredInclude.test.ts` — 5 integration tests (SQLite in-memory via TestProvider)

## Key design decisions
- **Runtime proxy approach**: lambda receives a `Proxy` that returns `IncludeSubquery` instances per property access; `instanceof IncludeSubquery` at call-time distinguishes filtered vs plain includes
- **In-memory post-filtering**: all related rows fetched via one `findWhereIn` call, then JS-level filter/sort/take applied independently per parent — no SQL predicate pushdown
- **Prevent double-load**: `loadLevel()` in IncludePlanner receives `skipTopLevelKeys: Set<string>` — skips batch-loading props already handled by filtered loading
- **thenInclude works**: after a filtered include sets `_lastIncludePath = 'posts'`, `thenInclude` appends `'posts.tags'` to `_includes`; regular batch loading handles nested levels (filtered loading only covers the top-level prop)

## Rebuilds required after changes
When `packages/types` or `packages/core` are modified:
```
pnpm -F @ts-linq/types run build
pnpm -F @ts-linq/core run build
pnpm -F @ts-linq/query run build
```
(typecheck uses dist of dependencies, not source)
