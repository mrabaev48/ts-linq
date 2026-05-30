---
"@ts-linq/types": minor
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
"@ts-linq/query": minor
"@ts-linq/migrations": minor
---

feat(p0-07): add inheritance mapping — TPH, TPT, TPC

- New `InheritanceStrategy` enum, `HierarchyMetadata`, `DiscriminatorMetadata` types in `@ts-linq/types`
- `EntityMetadata` extended with `hierarchy?` (root) and `hierarchyRoot?` (subtype) fields
- `MetadataRegistry`/`MetadataStorage` gain `setHierarchyMetadata()` and `setHierarchyRoot()` methods
- New `DiscriminatorBuilder<TKey>` fluent builder with `hasValue()` and `isComplete()` — mirrors EF Core API
- `EntityTypeBuilder` gains `hasDiscriminator()`, `useTphMappingStrategy()`, `useTptMappingStrategy()`, `useTpcMappingStrategy()`
- `Queryable.ofType<TSub>(ctor)` filters the query: TPH adds WHERE on discriminator, TPT adds INNER JOIN, TPC changes FROM table
- `RowMaterializer` performs polymorphic dispatch — reads discriminator value from DB row and instantiates the correct concrete subtype
- `ModelSnapshotBuilder` emits DDL-correct snapshots: TPH adds discriminator column, TPT registers subtype tables, TPC builds full leaf tables with inherited columns
