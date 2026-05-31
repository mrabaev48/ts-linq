# P0-11: Global Query Filters — Implementation Notes

## Status: DONE (PR #117, branch feat/p0-11-global-query-filters)

## Architecture Decision

Filters are stored **per-DbContext instance** (NOT in global MetadataStorage). This avoids pollution across concurrent contexts.

### Data flow
1. `EntityTypeBuilder.hasQueryFilterCompiled(name, { ast, parameters })` stores filters in `_queryFilters[]`
2. `ModelBuilder._finalize()` collects them into `EntityQueryFilterMap` (Map<Function, ReadonlyArray<QueryFilterMetadata>>)
3. `DbContext` stores map in `_entityQueryFilterMap`; `buildDbSetContext()` passes it via `DbSetContext.entityQueryFilterMap`
4. `DbSet._injectContext()` reads `context.entityQueryFilterMap?.get(this._entityClass)` → `_entityQueryFilters`
5. `DbSet.newQueryable()` passes `_entityQueryFilters` to `Queryable` constructor (11th arg)
6. `Queryable.applyGlobalFiltersToModel()` → `GlobalFilterApplier.apply(..., entityQueryFilters)` → `SqlVisitor.toSql(ast, params, columnResolver)` → WHERE clause

## Key Files
- `packages/types/src/index.ts` — `QueryFilterMetadata` interface
- `packages/orm/src/builders/EntityTypeBuilder.ts` — `hasQueryFilter`, `hasQueryFilterCompiled`, `_getQueryFilters()`
- `packages/orm/src/ModelBuilder.ts` — `EntityQueryFilterMap` type, `_getQueryFilterMap()`
- `packages/orm/src/DbSetContext.ts` — `entityQueryFilterMap?` field
- `packages/orm/src/DbSet.ts` — `_entityQueryFilters`, `ignoreQueryFilters()`
- `packages/query/src/Queryable.ts` — `_entityQueryFilters`, `_ignoredFilters`, `ignoreQueryFilters()`
- `packages/query/src/GlobalFilterApplier.ts` — per-context filter application
- `packages/transformer/src/index.ts` + `WhereTransformer.ts` — `hasQueryFilter` in TARGET_METHODS
- `packages/transformer/src/rewriters/HasQueryFilterRewriter.ts` — new rewriter
- `packages/transformer/src/scope/EntityTypeBuilderGuard.ts` — brand check for EntityTypeBuilder

## Public API
```ts
mb.entity(Post, b => {
  b.hasQueryFilter(p => !p.isDeleted);                   // unnamed → '_default'
  b.hasQueryFilter('softDelete', p => !p.isDeleted);     // named
  b.hasQueryFilter('tenant', p => p.tenantId === tid);   // named, captures closure
});
ctx.set(Post).ignoreQueryFilters().toArray();            // disable all
ctx.set(Post).ignoreQueryFilters('softDelete').toArray(); // disable named
```

## Important caveat: constructor ordering
In `DbContext` subclasses, `onModelCreating` is called during `super()`. Fields set AFTER `super()` are NOT yet initialized when `onModelCreating` runs. Use a module-level variable or static field to capture constructor args that onModelCreating needs:
```ts
let _tenantId = '';
class TenantCtx extends DbContext {
  constructor(p: Provider, tid: string) {
    _tenantId = tid;  // BEFORE super
    super({ provider: p });
  }
  protected onModelCreating(mb: ModelBuilder): void {
    const tid = _tenantId; // captured safely
    mb.entity(Post, b => b.hasQueryFilterCompiled('tenant', { ast, parameters: [tid] }));
  }
}
```

## TestProvider fix
Fixed `TestProvider.doExecuteQuery` WHERE parser to strip outer parens from each AND-condition before regex-parsing. Previously `(is_deleted = ?)` was parsed as `col="(is_deleted"` causing empty results.

## QueryFilterMetadata NOT stored in EntityMetadata (global)
`packages/metadata/src/MetadataRegistry.ts` still has `mergeFluentQueryFilter` method (for potential future use), and `EntityMetadata.queryFilters?` exists in types/EntityMetadata.d.ts, but the per-context filter flow bypasses global storage entirely.
