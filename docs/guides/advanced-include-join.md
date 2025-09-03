# Guide: Advanced Include and Joins

This guide covers advanced usage patterns for eager loading (include) and SQL joins.

## Include-first chaining

Call `include` before `where/select/orderBy` to ensure eager loading is applied:

```ts
const authors = await ctx.authors
  .include((a) => a.books)
  .where((a) => a.id >= 1)
  .toArray();
```

- Includes are validated against metadata
- Loader batches one-to-many queries to avoid N+1
- You can control depth via `context.find(..., { includes, depth })`

## Multiple includes and depth

```ts
await ctx.authors
  .include((a) => a.books)
  .include((a) => (a as any).profile)
  .toArray();
```

## Joins

Use `innerJoin` and `leftJoin` with simple predicate `(a, b) => a.prop === b.prop`:

```ts
const rows = await ctx.authors
  .innerJoin(Book, (a, b) => a.id === b.authorId)
  .where((a) => a.id > 0)
  .toArray();
```

Joins are primarily for filtering/projection scenarios. When you need full graph materialization, prefer `include`.

## Subqueries and unions

- `whereExists(subquery)`, `whereInSubquery(column, subquery)`
- `union(query)`, `unionAll(query)`

```ts
const q1 = ctx.books.where((b) => b.title === 'A');
const q2 = ctx.books.where((b) => b.title === 'B');
const both = await q1.clone().union(q2).toArray();
```
