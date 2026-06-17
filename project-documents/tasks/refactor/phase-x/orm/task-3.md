---
status: completed
phase: phase-x
package: orm
priority: P1
effort: L
risk: medium
category: architecture
depends_on: []
related: []
---

# Refactor: Replace `DbSet`'s manual Queryable forwarding

## Problem

`packages/orm/src/DbSet.ts` (797 LOC) re-implements the entire `Queryable<T>`
surface by hand-forwarding. Roughly 50 methods follow the identical shape:

```ts
public where(predicate) { return this.newQueryable().where(predicate); }
public select(selector) { return this.newQueryable().select(selector); }
// ...repeated for orderBy, take, skip, groupBy, having, distinct, include,
// union, intersect, joins, CTE, fallback, terminal ops, aggregates, pagination
```

This is a god-class regression: `DbSet` is supposed to be a *typed entity set
with mutation semantics*, but ~600 of its lines exist only to mirror
`Queryable`. Every new query operator added to `@ts-linq/query` must be copied
here by hand, with its overloads and JSDoc re-authored, or `DbSet` silently
falls behind.

## Evidence

- `DbSet.ts:341-694` — the forwarding block (filter, projection, ordering,
  pagination, grouping, distinct, include, set ops, joins, CTE/resilience,
  bulk DML, terminals, aggregates).
- `DbSet.ts:178-198` — `newQueryable()` constructs a fresh `Queryable<T>` with 11
  positional constructor args on every call (also a hot-path allocation concern).
- The genuinely DbSet-specific API is small: `local`, `find`, `findAsync`,
  `add/update/remove` (+ ranges), `insertMany/updateMany/upsert/upsertMany`,
  `_injectContext`, keyless guard.

## Why this is bad

- **API drift:** parity between `DbSet` and `Queryable` is maintained only by
  developer discipline; there is no compiler guarantee.
- **Duplication of JSDoc and overload signatures** (e.g. `toDictionaryAsync`,
  `include`, `orderBy`) — divergence already possible.
- **Maintainability:** trivial query features become two-file changes.
- **Allocation:** `newQueryable()` rebuilds an 11-arg `Queryable` per operator
  call; chained calls on a `DbSet` allocate redundantly.

## Target architecture

Apply composition + Liskov-safe delegation so the query surface lives in exactly
one place:

- **Option A (preferred): single seed + delegation.** Reduce `DbSet` to its
  mutation/find API plus a single `query(): Queryable<T>` (or make `DbSet`
  *thenable into* a Queryable seed). All query operators are reached via
  `ctx.users.query().where(...)` or by `DbSet` exposing only the entry operators
  that *start* a chain (`where`, `select`, `orderBy`, `include`, raw-SQL seeds)
  and returning `Queryable<T>` thereafter. Mid-chain operators are never
  re-declared on `DbSet`.
- **Option B: shared interface + generated/auto-forwarded delegate.** Define
  `IQueryableSurface<T>` in `@ts-linq/query`, have `Queryable<T>` implement it,
  and have `DbSet<T>` implement it by delegation through a single typed proxy
  helper, so the compiler enforces completeness (`implements IQueryableSurface`).
- Cache the seed `Queryable` (or its config) so chaining off a `DbSet` does not
  re-allocate the 11-arg constructor each operator.

Recommendation: Option A for ergonomics + zero drift, falling back to Option B if
EF-Core-parity requires every operator directly on `DbSet`.

## Proposed refactor

1. Decide A vs B with maintainers (parity expectation question).
2. If A: keep the small set of *chain-starting* operators on `DbSet`, delete the
   mid-chain re-declarations, and route them through one cached seed.
3. If B: extract `IQueryableSurface<T>` into `@ts-linq/query`, make both classes
   `implements` it; build a typed delegation helper so adding a method to the
   interface is a compile error until `DbSet` forwards it.
4. Extract `newQueryable()` arg assembly into a `QueryableFactory` (also reused
   by `DatabaseFacade.sqlQuery`, which constructs `Queryable` with a different
   arg count — see `DatabaseFacade.ts:99-106`).

## Suggested design patterns

- **Delegation / composition over inheritance** — DbSet *has-a* queryable seed
  rather than *re-being* one.
- **Factory** (`QueryableFactory`) — centralizes the 11-arg construction,
  removing positional-arg fragility duplicated across DbSet and DatabaseFacade.
- **Interface segregation** (Option B) — `IQueryableSurface` makes parity a
  compile-time contract.

## Testing plan

- **Contract test:** enumerate `Queryable.prototype` method names and assert the
  chosen surface reaches each (parity guard) — fails when a new operator is added
  but not surfaced.
- **Regression:** existing `tests-new/DbSet.test.ts`, `fromSql.test.ts`,
  `querySplittingBehavior.test.ts` must pass unchanged.
- **Type-level:** `test-d` cases proving `ctx.users.where(...).select(...)` keeps
  generic inference end-to-end.

## Acceptance criteria

- [ ] DbSet no longer hand-forwards mid-chain operators (or forwards via a
      compiler-enforced interface).
- [ ] `QueryableFactory` is the single construction site for `Queryable`.
- [ ] A contract test guards `DbSet`↔`Queryable` parity.
- [ ] No public signature regressions (`test-d` passes).
- [ ] DbSet LOC materially reduced (target < 350).

## Refactor order

1. Extract `QueryableFactory`.
2. Add parity contract test (captures current surface).
3. Apply chosen option behind the passing parity test.

## Notes

`__tsLinqWhereTransformerBrand` (DbSet.ts:37) and the `*Compiled` methods
(`whereCompiled`, `selectCompiled`, `havingCompiled`) are required by the
compile-time transformer and must remain reachable on whatever type the
transformer rewrites against — verify the transformer's receiver expectations
before removing any branded operators from `DbSet`.
