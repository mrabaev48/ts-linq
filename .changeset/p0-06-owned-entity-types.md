---
'@ts-linq/types': minor
'@ts-linq/metadata': minor
'@ts-linq/orm': minor
'@ts-linq/migrations': minor
'@ts-linq/core': minor
---

feat(p0-06): add OwnedEntityTypes — OwnsOne, OwnsMany, ToJson, table-splitting

- `StorageStrategy` enum (TableSplit | SeparateTable | Json) in `@ts-linq/types`
- `OwnedEntityMetadata` interface + `EntityMetadata.ownedEntities` field
- `MetadataRegistry.addOwnedEntity()` / `getOwnedEntities()` in `@ts-linq/metadata`
- New `OwnedNavigationBuilder<TOwner, TOwned>` in `@ts-linq/orm` with `property()`, `withOwner()`, `hasForeignKey()`, `hasKey()`, `toTable()`, `toJson()`
- `EntityTypeBuilder.ownsOne()` / `ownsMany()` on existing builder
- `ModelSnapshotBuilder` expands owned columns (TableSplit prefixed columns, Json column, SeparateTable extra table)
- `hydrateTableSplit` / `hydrateJson` / `hydrateOwnedEntities` materialization utilities in `@ts-linq/core`
