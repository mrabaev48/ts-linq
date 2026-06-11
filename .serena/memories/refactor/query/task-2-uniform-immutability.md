# refactor/query/task-2 — uniform immutability (✅ DONE)

query's **5th** completed refactor task (after task-4, task-8, task-6, task-3). Branch
`audit-refactor/query-uniform-immutability` from main (task-3 / PR #199 already merged).

## Problem fixed
`Queryable<T>` was inconsistently immutable: ~22 `return this` (in-place mutation) vs 18
`this.clone()`. Forking one base corrupted both branches:
`const a=base.take(10); const b=base.take(20)` → shared `_model.limit`. Now uniformly
immutable (persistent builder).

## Design: single derive path `withModel` (Template Method)
New `protected withModel(mutate: (model: QueryModel, draft: Queryable<T>) => void): Queryable<T>`
next to `clone()` in `packages/query/src/Queryable.ts`. Clones, applies `mutate` to the
clone's model (+ the draft itself), returns the fresh instance. **Every** chainable operator
routes through it.
- Signature is `(model, draft)` NOT just `(model)` — chain state like `_whereSignature`,
  `_includes`, `_filteredIncludes`, `_lastIncludePath`, `_abortSignal`, `_ignoredFilters`,
  `_fallbackManager` lives on the instance, not in `QueryModel`.
- `protected` NOT `private` — so `OrderedQueryable.thenBy/thenByDescending` reuse the same
  single path (no parallel clone-and-mutate).

## Converted mutators (wider than the task-file's list)
All now `return this.withModel(...)`, zero post-mutation `return this` (grep = 0):
task-file list: `whereIn` (2 paths), `whereCompiled`, `whereExists`, `whereInSubquery`,
`take`, `skip`, `distinct`, `union`/`unionAll`, `groupBy`, `havingCompiled`,
`orderBy`/`orderByDescending`, `ignoreQueryFilters`, `fallbackTo`, `withAbort`.
**Also found + converted** (not in task list, but mutate + `return this` in the same file):
`innerJoinOn`, `leftJoinOn` (via `draft._addJoinOn`), `include` (lambda path),
`_addSimpleInclude`, `thenInclude`, and `OrderedQueryable.thenBy`/`thenByDescending`.
- `orderBy`/`thenBy` build the `OrderedQueryable` from the **clone**:
  `OrderedQueryable._fromQueryable(this.withModel(...))` (was wrapping the mutated `this`).
- Guards/validation (`havingCompiled` groupBy-check, `include`/`thenInclude`
  `_validateIncludeProperty`) run **before** the clone (fail-fast).
- `ofType` was already immutable (builds a fresh `sub`) — untouched.

## `clone()` changes (required to avoid regressions once everything clones)
- Builds via `this.constructor` (not hardcoded `new Queryable`) → **subtype-preserving**:
  cloning an `OrderedQueryable` yields an `OrderedQueryable` (keeps `thenBy`, honors
  `ignoreQueryFilters(): this`). Also fixes a latent bug where `asNoTracking()` on an
  ordered query dropped the subtype.
- Now also copies `_cte`, `_abortSignal`, `_performance` (were not propagated; would be
  silently dropped by the next operator after `withCte`/`withAbort`/`withFallbackPolicy`).
- `QueryModel.clone()` already deep-clones `where`/`orderBy`/`groupBy`/`joins`/`unions`, so
  pushing onto the clone's arrays is isolated from the original.

## Tests
- `tests-new/Queryable.test.ts`: new `describe('fork safety / uniform immutability (task-2)')`
  — every-operator-returns-new-ref, canonical take fork hazard, per-operator fork isolation
  (skip/whereIn/groupBy/orderBy/union), `orderBy().thenBy()` chain on fresh instance,
  `withAbort` signal propagation through a later operator.
- **Adapted existing mutation-reliant tests** (correct migration, not weakening): 5 join
  tests in `Queryable.test.ts`, 6 include tests in `filteredInclude.test.ts`, 2 bulk tests in
  `executeUpdateDelete.test.ts` — all now capture the returned instance instead of inspecting
  the (no-longer-mutated) original.

## Removed import
`OrderByClause` no longer used in `Queryable.ts` (inlined object literals) → dropped from the
`@ts-linq/types` import.

## Validation (all green)
typecheck 32/32, lint 0 errors (only pre-existing test-file QueryContext-resolution warnings),
unit 3220, integration 461 (+2 skipped), e2e 290 (temporal e2e flaky on first full run, green
in isolation + re-run), build 32/32, arch deps/cycles/dead clean.

## Versions
`@ts-linq/query` **minor** 2.4.38 → **2.5.0** (+ `@ts-linq/orm` patch, dependent bump). Changeset
migration note: "capture the returned instance — `q.take(10)` no longer mutates `q`."

## Unblocks
`query/task-1` (god-class decomposition relies on a single immutable derive contract).
Remaining query tasks: 1, 7, 5, 9, 10.
