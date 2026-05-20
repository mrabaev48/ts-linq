# P1-18 — AsSplitQuery / AsSingleQuery

**Status:** ✅ Completed on feat/p1-18-as-split-query branch

## Summary
Implemented EF Core-style query splitting behavior: `asSplitQuery()`, `asSingleQuery()`, `useQuerySplittingBehavior()` global default, and `toListAsync()` alias.

## Public API Added

### `@ts-linq/types`
- `QuerySplittingBehavior` enum: `SplitQuery = 'SplitQuery'`, `SingleQuery = 'SingleQuery'`

### `@ts-linq/query` — `Queryable<T>`
- `asSplitQuery(): Queryable<T>` — per-query override, returns new immutable instance
- `asSingleQuery(): Queryable<T>` — per-query override, returns new immutable instance
- `toListAsync(): Promise<T[]>` — alias for `toArray()` (EF Core naming convention)
- Protected getter `effectiveSplittingBehavior` — resolves: per-query override ?? global ?? SplitQuery
- Constructor param 10: `globalSplittingBehavior?: QuerySplittingBehavior`

### `@ts-linq/orm` — `DbContextOptionsBuilder`
- `useQuerySplittingBehavior(behavior: QuerySplittingBehavior): this` — fluent, sets global default
- Re-exports `QuerySplittingBehavior` from `@ts-linq/types`

## Architectural Decisions

### Enum placement in `@ts-linq/types`
- Rationale: `@ts-linq/core` defines `DbContextOptions` which needs `querySplittingBehavior`
- `@ts-linq/core` cannot depend on `@ts-linq/query` (would create a cycle)
- Solution: enum lives in `@ts-linq/types` (no dependencies), imported by all layers

### SplitQuery vs SingleQuery semantics
- `IncludePlanner` already uses batched IN queries (not JOINs), so both modes share the same implementation path
- `populateIncludes` accepts `splittingBehavior` param; uses `void splittingBehavior` to suppress unused-var warning
- The param is preserved for future JOIN-based optimization in SingleQuery mode

## Files Modified
- `packages/types/src/index.ts` — added `QuerySplittingBehavior` enum
- `packages/types/tests/type-exports.test.ts` — added `QuerySplittingBehavior` to expected exports
- `packages/core/src/types/index.ts` — added `querySplittingBehavior?` to `DbContextOptions`
- `packages/query/src/options/QuerySplittingBehavior.ts` — re-export shim (created)
- `packages/query/src/QueryModel.ts` — added `splittingBehavior?` field, updated `clone()`
- `packages/query/src/Queryable.ts` — added `asSplitQuery`, `asSingleQuery`, `toListAsync`, `effectiveSplittingBehavior`, 10th constructor param
- `packages/query/src/QueryExecutor.ts` — propagates `splittingBehavior` through execution pipeline
- `packages/query/src/IncludePlanner.ts` — accepts `splittingBehavior` param
- `packages/query/src/index.ts` — exports `QuerySplittingBehavior`
- `packages/orm/src/DbContextOptionsBuilder.ts` — `useQuerySplittingBehavior()`, re-exports enum
- `packages/orm/src/DbSetContext.ts` — added `querySplittingBehavior?` field
- `packages/orm/src/DbSet.ts` — passes global behavior to `Queryable` constructor
- `packages/orm/src/DbContext.ts` — reads and propagates `querySplittingBehavior` from options

## Tests Added
- `packages/query/tests-new/asSplitQuery.test.ts` — 17 unit tests
- `packages/orm/tests-new/querySplittingBehavior.test.ts` — 7 unit tests
- `packages/integration-tests/tests-new/07-advanced-features/asSplitQuery.test.ts` — 7 integration tests

## Validation Results
- typecheck: ✅ 31 packages
- unit tests: ✅ 1857 tests
- integration tests: ✅ 112 tests
- e2e tests: ✅ 144 tests
- build: ✅ 32 tasks
- arch:deps: ✅ no violations
- arch:cycles: ✅ no cycles
- arch:dead: ✅ clean
