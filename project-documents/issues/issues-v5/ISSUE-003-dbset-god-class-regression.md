# ISSUE-003: `DbSet` regressed to a god class after PR #66

## Severity

High

## Category

- SOLID (SRP)
- Clean Code
- Maintainability
- Public API

## Location

- `packages/orm/src/DbSet.ts` (515 LOC, 53 public-method signatures, single class `DbSet<T>`)

## Problem

ISSUE-017 in audit v4 (closed) reduced `DbSet` from 604 LOC / 35 methods to "11 public methods (mutations + `query()` entry point)". PR #66 (May 2026) re-introduced the EF-Core-style "DbSet IS-A Queryable" pattern and re-inflated the class.

`packages/orm/src/DbSet.ts` now contains, in a single class:

- **Mutation methods** (kept from the SRP-clean state): `add`, `update`, `remove`, `addRange`, `updateRange`, `removeRange`, `insertMany`, `updateMany`, `upsert`, `upsertMany` (~10).
- **Query delegation methods** (added in PR #66, each constructs a fresh `Queryable<T>` and forwards): `where`, `whereIn`, `whereExists`, `select`, `orderBy`, `orderByDescending`, `thenBy`, `thenByDescending`, `take`, `skip`, `paginate`, `keysetPaginate`, `groupBy`, `having`, `innerJoinOn`, `leftJoinOn`, `include`, `thenInclude`, `withCte`, `union`, `unionAll`, `concat`, `intersect`, `except`, `distinct`, `fallbackTo`, `withFallbackPolicy`, `withAbort` (~28).
- **Terminal operators** (also forwarded): `toArray`, `first`, `firstOrDefault`, `single`, `singleOrDefault`, `any`, `contains`, `count`, `sum`, `average`, `min`, `max` (~12).
- **Lifecycle / context**: `_injectContext`, `entityClass`, brand fields.

This is functionally equivalent to "embed `Queryable<T>`'s entire surface area into `DbSet<T>` by hand" — a textbook delegation god class.

The same problem ISSUE-017 v4 diagnosed (one class with too many responsibilities, hard to extend, hard to grep, hard to mock) is back. ISSUE-017's recommended fix ("reduce DbSet to mutation + entry point") was overwritten by the EF-Core-style design.

## Evidence

- `wc -l packages/orm/src/DbSet.ts` → 515.
- `grep -E "^\s+public\s+" packages/orm/src/DbSet.ts | wc -l` → 53.
- Each query method body is a 1–4-line stub building a `new Queryable(...)` and forwarding. Example (typical pattern across ~28 methods):
  ```ts
  public orderBy<K extends keyof T>(keyOrSelector: K | ((entity: T) => unknown)): Queryable<T> {
    return this.query().orderBy(keyOrSelector);
  }
  ```
- `packages/orm/src/DbSet.ts:17-25` — JSDoc explicitly markets the regression as a feature ("Mirrors EF Core's DbSet<T> — query methods are available directly without an intermediate .query() call").
- The previous v4 fix lives in git history (`packages/orm/src/DbSet.ts` was 11 public methods between commits referenced in `issues-v4/ISSUE-017-dbset-secondary-god-class.md`).

## Why It Matters

- **SRP violation**: `DbSet` now owns both **identity / change-tracking** (mutations against the tracked entity set) and **query construction** (forwarding the entire `Queryable` API). These have different reasons to change.
- **Public-API surface duplication**: Any new `Queryable` method must be mirrored on `DbSet` (and on any future `IQueryable` interface). Maintenance is O(2) per query feature, with drift risk (e.g. `Queryable.where()` accepting overloads not surfaced on `DbSet.where()`).
- **Diff noise**: A single change to one operator now touches both files.
- **Testing**: Mocking `DbSet` to assert a query was constructed requires stubbing ~28 stubs each of which is structurally identical.
- **Discoverability inverted**: ISSUE-017 v4 was acknowledged-and-merged; the regression reintroducing it indicates the audit's recommendations were not load-bearing on the design — the same class will re-grow until the API shape problem is solved at the type level.

## Recommended Fix

Pick one of the two structural options; the third (do nothing) is what created the regression.

A. **Make `DbSet<T>` extend or implement `Queryable<T>`'s interface.** Define `interface IQueryable<T>` in `@ts-linq/query` (the existing `TypedQueryable.ts` is a candidate location), let `DbSet<T>` implement it via a single `[Symbol.iterator]`-style delegation — but in the type-system sense, not by hand-rolling 28 forwarders. A `mixin` or `class DbSet<T> extends Queryable<T>` would erase the duplication.

B. **Restore the `.query()` entry point as the only query surface on `DbSet`.** Revert PR #66's "direct querying" feature, restore `.query()` (or rename to `.asQueryable()`), and document that the EF-Core ergonomics are a non-goal. This was the post-v4 design.

(A) preserves the EF-Core ergonomics and removes the duplication; (B) is simpler and matches the audit-v4 fix.

## Acceptance Criteria

- `packages/orm/src/DbSet.ts` contains ≤ 15 public methods, OR contains a single `extends/implements`-based wiring that produces the query surface without per-method hand-forwarding.
- Adding a new method to `Queryable<T>` (e.g. `.tap()`) requires changing exactly one file in `packages/query/` and zero files in `packages/orm/` to make it available on `DbSet`.
- `wc -l packages/orm/src/DbSet.ts` ≤ 250.
- All existing `DbSet` query call sites in tests/examples continue to work without changes (or with a documented migration).
- `pnpm typecheck && pnpm test` green.
