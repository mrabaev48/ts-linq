# P1-20 — Compiled Queries (EF.compileQuery / EF.compileAsyncQuery)

**Status:** done (PR #91)
**Branch:** feat/p1-20-compiled-queries (merged into main)

## Architecture

### Core problem solved
`QueryBuilder.buildCacheKey` serialises WHERE parameter VALUES into the key
(`Customer|w:id = ?(42)` vs `Customer|w:id = ?(99)` → different keys → SQL re-generated every call).
For compiled queries we need structure-only keys that match regardless of runtime parameter values.

### Solution: TemplateSqlCache + plan-level key normalisation

#### `@ts-linq/types` additions
- `TemplateSqlCache extends SqlCache` — adds `getTemplate(key): {query}|undefined`, `cacheHits`, `cacheMisses`
- `isTemplateSqlCache(cache): cache is TemplateSqlCache` — runtime type guard
- `compiledPlan?: boolean` added to `QueryStartInfo`

#### `packages/query/src/compiled/CapturedQueryPlan.ts` (new)
- `normaliseKey(key)`: strips `?(val)` → `?()` and `)(val)` → `)()`
- `PlanSqlCache implements TemplateSqlCache`: stores SQL templates with normalised keys, tracks hit/miss counts
- `CapturedQueryPlan<TCtx, TParams, TResult>`: wraps factory lambda + owns PlanSqlCache
  - `execute(ctx, ...params)`: increments `_invocations`, calls factory
  - `planSqlCache`: injectable as `performance.sqlCache` in DbContextOptions
  - `cacheHits`, `cacheMisses`, `invocationCount`, `isWarm` (cacheHits > 0)

#### `packages/query/src/EF.ts` (new)
- `CompiledQueryFn<TCtx, TParams, TResult>` type alias
- `EF.compileQuery(factory)` → returns `fn & { plan: CapturedQueryPlan }`
- `EF.compileAsyncQuery(factory)` → alias for `compileQuery` (same implementation)

#### `packages/query/src/QueryBuilder.ts` (modified)
In `generateSql()`, before the regular cache lookup:
```typescript
if (isTemplateSqlCache(this._cache)) {
  const planKey = QueryBuilder.buildPlanKey(key);
  const template = this._cache.getTemplate(planKey);
  if (template) {
    return { query: template.query, parameters: QueryBuilder.extractCurrentParams(options) };
  }
}
```
After SQL generation:
```typescript
if (isTemplateSqlCache(this._cache)) {
  const planKey = QueryBuilder.buildPlanKey(key);
  this._cache.set(planKey, { query: built.query, parameters: [] });
}
```
New static methods: `buildPlanKey(fullKey)`, `extractCurrentParams(options)`

#### `packages/telemetry/src/provider/TelemetryProvider.ts`
`queryStart()` sets `db.query.compiled=true` when `info.compiledPlan === true`

#### `packages/transformer/src/visitors/EFCompileQueryVisitor.ts` (stub)
Reserved for P2-44 AOT compile-time optimisation. Re-exported as `export type` from transformer index.

## Usage pattern
```typescript
const getById = EF.compileQuery((ctx: AppContext, id: number) =>
  ctx.users.whereIn('id', [id]).firstOrDefault()
);

const ctx = new AppContext({
  provider,
  performance: { sqlCache: getById.plan.planSqlCache }
});

const user1 = await getById(ctx, 1);  // cache miss — template stored
const user2 = await getById(ctx, 2);  // cache hit — SQL reused, params rebound
// getById.plan.cacheHits === 1, getById.plan.isWarm === true
```

## Key normalisation
Key pattern `Customer|w:"id" IN (?)(1)` → normalised to `Customer|w:"id" IN (?)()`
Pattern `Customer|w:id = ?(42)` → normalised to `Customer|w:id = ?()`

## Exports added to `@ts-linq/query`
- `EF` class
- `CapturedQueryPlan` class
- `CompiledQueryFn` type

## Tests
- 29 unit tests: `packages/query/tests-new/compiledQuery.test.ts`
- 6 integration tests: `packages/integration-tests/tests-new/07-advanced-features/compiledQuery.test.ts`
- 12 e2e tests (skipped with SKIP_DB_TESTS=1): `packages/e2e-tests/tests/queries/compiledQuery.e2e.test.ts`

## Known limitation
`TestProvider.doExecuteQuery` does not filter `IN (?)` by SQL parameters (treats as pass-through).
Integration tests for `whereIn` only verify `invocationCount` and `cacheHits`, not result correctness.

## Unblocked tasks
- P2-44 Compiled models / AOT prep — now unblocked
