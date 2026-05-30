---
"@ts-linq/types": minor
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
"@ts-linq/query": minor
"@ts-linq/transformer": minor
---

feat(P0-11): Add global query filters with EF9 named-filter support

Adds model-level named query filters (`hasQueryFilter`) on `EntityTypeBuilder<T>` and
per-query opt-out (`ignoreQueryFilters()`) on `DbSet<T>` / `Queryable<T>`, matching
EF Core 9 semantics.

- **`@ts-linq/types`**: New `QueryFilterMetadata` interface.
- **`@ts-linq/metadata`**: `EntityMetadataBuilder.addQueryFilter()` and `MetadataRegistry.mergeFluentQueryFilter()`.
- **`@ts-linq/orm`**: `EntityTypeBuilder.hasQueryFilter(pred)` / `hasQueryFilter(name, pred)` (transformer-compiled), `DbSet.ignoreQueryFilters()`, `ModelBuilder` exposes per-context filter map.
- **`@ts-linq/query`**: `Queryable.ignoreQueryFilters()`, `GlobalFilterApplier` applies per-context filters at query time.
- **`@ts-linq/transformer`**: Rewrites `hasQueryFilter(lambda)` → `hasQueryFilterCompiled(ast, params)` at compile time (same mechanism as `where()`).
