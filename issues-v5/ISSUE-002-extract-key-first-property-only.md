# ISSUE-002: `extractKey()` silently drops all but the first property access in selector lambdas

## Severity

High

## Category

- Type System
- Public API
- Testability
- Clean Code

## Location

- `packages/query/src/Queryable.ts:923-942` — `extractKey()` helper
- Call sites (in the same file): `orderBy`, `orderByDescending`, `thenBy`, `thenByDescending`, `include`, `thenInclude`, `innerJoinOn`, `leftJoinOn` (all delegate-through-DbSet)
- `packages/orm/src/DbSet.ts` — same selector union signatures forwarded to `Queryable`

## Problem

`extractKey()` converts a lambda selector to a property-name string by intercepting property access through a `Proxy`:

```ts
function extractKey<T>(keyOrSelector: keyof T | ((entity: T) => unknown)): string {
  if (typeof keyOrSelector !== 'function') return String(keyOrSelector);
  const accessed: string[] = [];
  const proxy = new Proxy(
    {},
    {
      get(_, prop) {
        accessed.push(String(prop));
        return proxy;
      }
    }
  ) as T;
  keyOrSelector(proxy);
  if (!accessed.length) throw new Error('Could not extract property name from selector lambda');
  return accessed[0];
}
```

Three independent defects:

1. **Only the first access is returned** (`return accessed[0]`). For `u => u.profile.city`, the Proxy records `['profile', 'city']`, but only `"profile"` is used downstream — the query is built against the wrong column with no warning. The proxy returns itself on every `get`, so chained access is silently swallowed.

2. **Branching expressions produce wrong-but-accepted results.** `u => u.deleted ? u.deletedAt : u.createdAt` records `['deleted', 'deletedAt', 'createdAt']` — `accessed[0]` is `"deleted"`, not the column the user expected to sort by.

3. **Computed / non-property selectors are accepted silently.** A lambda like `u => 42` throws "Could not extract property name", but `u => u.name.length` returns `"name"` instead of failing — the helper cannot tell "property of T" from "property of property-of-T".

The selector union `keyof T | ((entity: T) => unknown)` (every ordering / join / include method) gives the user the impression that dotted lambdas (`u => u.profile.city`) are first-class. They are not.

## Evidence

- `packages/query/src/Queryable.ts:933-936` — `get` trap appends every property name; only `accessed[0]` is read.
- `packages/query/src/Queryable.ts:927` — return type `string` and signature `keyof T | ((entity: T) => unknown)` together imply support for arbitrary projections; nothing in JSDoc rules out nested paths.
- The README / JSDoc on `DbSet` (`packages/orm/src/DbSet.ts:21-24`) advertises lambda selectors as an EF-Core-like API, where `OrderBy(u => u.Profile.City)` is valid in EF Core but silently broken here.
- `IncludePlanner.loadLevel` (`packages/query/src/IncludePlanner.ts:23-31`) does parse dot-notation paths — meaning `.include` *can* receive `"profile.city"` strings — but the lambda path never produces them, so the lambda variant is strictly less powerful than the string variant.

## Why It Matters

- **Correctness risk**: Queries silently produce results from the wrong column. There is no compile-time error, no runtime error, no test scaffold that would catch this — output just looks plausibly wrong.
- **API stability**: Adding nested-path support later changes the meaning of existing user code (currently `u => u.profile.city` "works" returning a column named `profile`; a fix changes it to `profile.city`). Migration becomes a breaking change.
- **Discoverability**: Users coming from EF Core/LINQ will expect dotted lambdas to work; the implementation does not, but does not say so.
- **Type-system erosion**: The `unknown` return on the selector throws away the very information the Proxy is trying to recover, hiding the gap from the compiler.

## Recommended Fix

Either:

A. **Restrict the lambda contract.** Have the union be `keyof T | ((entity: T) => T[keyof T])` and document that only single-property selectors are supported. Throw inside `extractKey()` when `accessed.length > 1` (current behaviour silently truncates; an error is correct). Add a test fixture asserting this.

B. **Implement nested paths properly.** Walk `accessed` and join with `"."`; downstream consumers (`IncludePlanner.loadLevel`) already understand dotted paths. For ordering / joining, validate that each segment is a real navigation property at metadata level, throw otherwise.

C. **Statically extract the path via the existing AST transformer.** `packages/transformer/src/expression.ts` already rewrites where-lambdas at compile time; extending it to translate selectors avoids the Proxy entirely and recovers type safety.

Option (C) is the most correct long-term solution; (A) is the smallest immediate change that closes the silent-correctness hole.

## Acceptance Criteria

- `extractKey('u => u.a.b')` either:
  - returns the full dotted path `"a.b"` and downstream consumers handle it, OR
  - throws a descriptive error mentioning "nested-path selectors are not supported".
- Unit test in `packages/query/tests/` covers: single-property, dotted, branching, and computed selectors — each with the expected pass/throw behaviour.
- Public JSDoc on every `orderBy/include/thenBy/...` method states the selector contract explicitly.
- `pnpm typecheck && pnpm test:unit` green.
