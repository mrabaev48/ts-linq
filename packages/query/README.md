# @ts-linq/query

> The fluent, strongly typed query API: `Queryable`, query execution, the `EF` helpers,
> result materialization, caching, and resilient fallbacks.

This package turns AST-backed query expressions into executed SQL and materialized entities. It
provides the chainable `Queryable`/`TypedQueryable` surface, the execution pipeline, the `EF`
functions namespace, include planning, pagination, query tags, and the caching layer
(`SqlCache`, `CountCache`, LRU/TTL decorators).

## Installation

```bash
pnpm add @ts-linq/query
```

## What lives here

- **Fluent query API** — `Queryable`, `TypedQueryable`, `QueryBuilder`, `QueryModel`,
  `PaginationBuilder`, `AsyncQueryable`.
- **Execution** — `QueryExecutor`, `RowMaterializer`, `IncludePlanner`, `GlobalFilterApplier`.
- **`EF` helpers** — `EF`, `EF.functions` (`EfFunctions`), compiled queries (`CapturedQueryPlan`,
  `CompiledQueryFn`).
- **Caching** — `SqlCache` (`InMemorySqlCache`), `EnhancedSqlCache`, `CountCache`, `LruCache`,
  `MetricsCacheDecorator`, `TtlCacheDecorator`.
- **Resilience** — `FallbackManager`, `MemoryFallback`.
- **Query tags** — `tag-with`, `tag-with-call-site`, `QueryTagError`, `sanitizeTag`.
- **Set-based updates** — `SetPropertyCalls` (`ExecuteUpdate`-style setters).
- **Errors** — `IncludeResolutionError`.

## Exports

- `.` — the public API barrel.
- `./internal` — internal collaborators (not part of the stable contract; import at your own risk).

## Usage

```ts
const adults = await queryable(User)
  .where(u => u.age >= 18)
  .orderBy(u => u.name)
  .take(20)
  .toArrayAsync();
```

## Package structure

```
src/
  Queryable.ts, TypedQueryable.ts, QueryBuilder.ts, QueryModel.ts
  QueryExecutor.ts, RowMaterializer.ts, IncludePlanner.ts, GlobalFilterApplier.ts
  EF.ts, EF.functions.ts, compiled/CapturedQueryPlan.ts
  SqlCache.ts, EnhancedSqlCache.ts, CountCache.ts, LruCache.ts, *CacheDecorator.ts
  fallbacks/, async/AsyncQueryable.ts, include/, ast/query-tags.ts
  index.ts          # public barrel
  internal/index.ts # ./internal entrypoint
```

## Dependencies

- `@ts-linq/types`, `@ts-linq/metrics-safe`, `@ts-linq/ast`, `@ts-linq/sql-visitor`,
  `@ts-linq/core`, `@ts-linq/metadata`

## License

Part of the ts-linq monorepo. See the repository root for license details.
