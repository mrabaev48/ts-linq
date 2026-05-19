# ISSUE-007: Lambda-selector signatures erase `keyof T` and produce false inference

## Severity

Medium

## Category

- Type System
- Public API

## Location

- `packages/query/src/Queryable.ts` — `orderBy`, `orderByDescending`, `thenBy`, `thenByDescending`, `include`, `thenInclude`, `innerJoinOn`, `leftJoinOn`
- `packages/orm/src/DbSet.ts` — mirror signatures forwarded to `Queryable`

## Problem

The selector parameter on every chainable method follows this shape:

```ts
orderBy<K extends keyof T & string>(
  keyOrSelector: K | ((entity: T) => unknown)
): Queryable<T>
```

The `K | ((entity: T) => unknown)` union throws away the information the type system has when the caller passes the *string* form, and never recovers it when the caller passes the *lambda* form. Concretely:

1. The lambda variant accepts `(entity: T) => unknown`. The compiler never checks that the body actually accesses a property of `T`; `u => 42` and `u => globalSomeOtherThing` both type-check.
2. The Proxy in `extractKey()` (see ISSUE-002) accepts any property name at runtime, so `u => (u as any).whatever` also passes.
3. The return type is always `Queryable<T>` — there is no `OrderedQueryable<T, K>` to encode "we already sorted by `name`, now offer `thenBy` for compatible secondary keys". EF Core / LINQ-to-Objects do this; the present design throws away the K parameter immediately.
4. `thenBy` / `thenByDescending` have no compile-time precondition that `orderBy` was called first. Calling `q.thenBy('x')` directly returns a query the SQL emitter cannot execute — the bug surfaces at the database, not at compilation.
5. The same pattern repeats across 8+ methods, so the erosion is structural, not a one-off.

## Evidence

- `packages/query/src/Queryable.ts:927` — `extractKey` signature `keyof T | ((entity: T) => unknown)`.
- The same union shape repeats in `orderBy` / `thenBy` / `include` / `thenInclude` / `innerJoinOn` / `leftJoinOn` on both `Queryable` and `DbSet`.
- `packages/query/src/TypedQueryable.ts` exists (see `packages/query/src/index.ts:17`) but is not used by `DbSet` or `Queryable.orderBy` — the typed variant is orphaned at the type level.
- `extractKey<T>(...)` returns `string`, not `keyof T` or `T[K]` — the K parameter on `orderBy<K>` is decorative.

## Why It Matters

- **Type-safety risk**: Users believe lambda selectors are type-safe because they are typed `(entity: T) => unknown` — that signature is a lie. There is no compile-time guarantee that the body refers to T at all.
- **Refactor risk**: Renaming a column in T does not surface as a TypeScript error in any of the lambda-using call sites. Only the string form, narrowed to `keyof T`, surfaces a rename.
- **API drift**: The "ordered queryable" state is not encoded, so `q.thenBy(...)` is allowed at any time. New developers writing fluent chains expect the type to refine; it doesn't.
- **Loss of LSP-driven discoverability**: Autocomplete in `u => u.|` works (because `entity: T`), but the compiler cannot verify that the chosen field actually matches the column the SQL emitter will use — they're connected only by the Proxy in `extractKey`.

## Recommended Fix

1. **Strengthen the lambda's return type**: replace `(entity: T) => unknown` with `(entity: T) => T[keyof T]`. Combined with ISSUE-002 (restricting lambdas to single-property accesses), this makes the lambda equivalent in power to the string form.
2. **Introduce `OrderedQueryable<T>`** as a structural refinement: `orderBy` returns `OrderedQueryable<T>`, `thenBy` is only available on `OrderedQueryable<T>`. Mirrors LINQ-to-Objects. The existing `TypedQueryable.ts` is a natural home.
3. **Statically extract the path via the existing AST transformer**: `packages/transformer/src/expression.ts` rewrites `where(u => u.x === 1)` to a stringified expression at compile time. Extending it to `orderBy`/`include` selectors would recover full type-safety and align with the project's existing transformer-based design.

Options (1) and (2) are incremental; (3) is the architecturally correct long-term direction.

## Acceptance Criteria

- The lambda variant signature is `(entity: T) => T[keyof T]` (or stronger), and `u => 42` fails to compile.
- `OrderedQueryable<T>` exists; `orderBy` returns it; `thenBy` is unavailable on plain `Queryable<T>`.
- A type-test (e.g. `tsd` in `packages/orm/test-d/`) asserts that `db.users.thenBy('name')` is a type error and `db.users.orderBy('name').thenBy('age')` is not.
- `pnpm typecheck && pnpm test:unit && pnpm test:e2e` green.
