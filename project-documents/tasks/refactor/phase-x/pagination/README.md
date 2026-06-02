# Refactor Audit: pagination

## Package responsibility

`@ts-linq/pagination` is declared as the home for pagination utilities, but
currently contains **only** an 8-line `PagedResult<T>` interface
(`src/index.ts`) and no implementation. The actual pagination logic
(`paginate`, `keysetPaginate`) lives entirely in `@ts-linq/query`
(`PaginationBuilder.ts`, surfaced on `Queryable`/`DbSet`). This package is a
placeholder.

## Current architectural problems

1. **Empty placeholder package with zero consumers.** `src/index.ts` exports one
   interface; a repo-wide search for `@ts-linq/pagination` and `PagedResult`
   importers outside the package returns nothing. No package depends on it.
2. **Misleading ownership / split responsibility.** The package *name* implies it
   owns pagination, but the real implementation is in `@ts-linq/query`
   (`PaginationBuilder.ts:28 paginate`, `:41 keysetPaginate`;
   `TypedQueryable.ts:167,184`). A maintainer looking for pagination logic is
   pointed at the wrong package.
3. **`PagedResult<T>` shape diverges from the actual return types.** The
   placeholder interface is `{ data, page, pageSize, total, totalPages }`, but
   `Queryable.paginate` returns `{ items, total, page, size }` and
   `keysetPaginate` returns `{ items, pageSize, nextAfter }`. The "canonical"
   type is unused and inconsistent with reality.
4. **Pre-1.0 / alpha version with no `exports` map.** `package.json` is
   `2.0.0-alpha.1`, has no `dependencies`, and (unlike `orm`/`concurrency`)
   declares **no `exports` field**, so subpath/ESM resolution relies solely on
   `main`/`module`/`types`.
5. **Tests test nothing real.** `tests-new/PagedResult.test.ts` only asserts the
   interface accepts object literals; `PropertyBasedKeysetPagination.test.ts` is a
   pure in-memory model with no import from the package under test (it validates a
   concept, not this package's code).

## Refactor goals

Decide and document the package's fate, then make code match the decision. Two
coherent options (captured as task-1, a decision task):

- **(A) Make it real:** move `paginate`/`keysetPaginate` and a unified
  `PagedResult`/`KeysetPage` type out of `@ts-linq/query` into this package, and
  have `query` depend on it. Removes the misleading split.
- **(B) Retire it:** delete the package (it has no consumers, is private + alpha)
  and keep pagination owned by `@ts-linq/query`, where it already lives.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Decide: promote vs retire the placeholder package | P2 | Empty package with misleading ownership; no consumers — needs a decision before any code moves |

## Dependencies on other packages

None declared (`package.json` has no runtime dependencies) and no package depends
on it. The conceptually-related implementation is in `@ts-linq/query`.

## Testing strategy

- If promoted (A): unit + property-based tests against the *moved* implementation
  (the existing property-based test can import the real keyset function instead of
  re-modeling it); contract tests for the unified result types; regression across
  `query`/`orm` pagination callers.
- If retired (B): confirm no importers, remove the package, update workspace
  config and any docs referencing it.

## Notes

This is the clearest "placeholder/decision" finding in cluster C3. It is low
runtime risk (nothing imports it) but high *clarity* cost: the package advertises
a responsibility it does not fulfill, and its one exported type contradicts the
real return shapes in `@ts-linq/query`. The single task is intentionally a
decision/investigation task per the audit conventions.
