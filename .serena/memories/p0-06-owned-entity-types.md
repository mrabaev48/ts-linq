# P0-06: Owned Entity Types — DONE

## Status: ✅ Completed (feat/p0-06-owned-entity-types)

## What was implemented

### New types — `@ts-linq/types`
- `StorageStrategy` enum: `TableSplit | SeparateTable | Json`
- `OwnedEntityMetadata` interface (ownerPropertyName, ownedType, strategy, columnPrefix, jsonColumnName, foreignKeyColumns, compositeKeyColumns, isCollection)
- `EntityMetadata.ownedEntities?: OwnedEntityMetadata[]`

### Metadata layer — `@ts-linq/metadata`
- `EntityMetadataBuilder.addOwnedEntity(owned): this`
- `MetadataRegistry.addOwnedEntity(owner, owned): void`
- `MetadataRegistry.getOwnedEntities(owner): OwnedEntityMetadata[]`
- Re-exports: `StorageStrategy`, `OwnedEntityMetadata` from `@ts-linq/types`

### ORM builders — `@ts-linq/orm`
- NEW: `OwnedNavigationBuilder<TOwner, TOwned>` — fluent builder with `property()`, `withOwner()`, `hasForeignKey()`, `hasKey()`, `toTable()`, `toJson()`, `columnPrefix()`
- `EntityTypeBuilder.ownsOne(selector, ownedCtor?, configure?)` — defaults to TableSplit
- `EntityTypeBuilder.ownsMany(selector, ownedCtor?, configure?)` — defaults to SeparateTable (because isCollection=true)
- Internal helper `resolveOwnedArgs()` — distinguishes class constructors from arrow functions via `.prototype`

### Migration snapshot — `@ts-linq/migrations`
- `ModelSnapshotBuilder.buildFromMetadata()` now expands owned entities:
  - TableSplit: adds prefixed columns to owner table
  - Json: adds a single `JSON` column to owner table
  - SeparateTable: creates extra `ModelTableSnapshot` with FK primary keys

### Materialization utilities — `@ts-linq/core`
- `hydrateTableSplit(row, ctor, prefix, propToColMap?)` — rebuilds owned from flat row
- `hydrateJson(row, ctor, columnName)` — rebuilds owned from JSON column
- `hydrateOwnedEntities(row, ownerInstance, ownedMetas)` — applies all strategies to owner

## Design decisions
- `ownsMany` with TableSplit → auto-promotes to SeparateTable (you can't inline a collection)
- `withOwner()` is a no-op (returns `this`) — ownership is tracked via OwnedEntityMetadata
- Second argument to `ownsOne`/`ownsMany` is disambiguated: if `.prototype !== undefined` → class constructor; otherwise → configure callback
- SeparateTable materialization is deferred (requires separate query, out of P0-06 scope)

## Files changed
- `packages/types/src/index.ts`
- `packages/metadata/src/EntityMetadata.ts`, `MetadataRegistry.ts`, `index.ts`
- `packages/orm/src/builders/EntityTypeBuilder.ts`, `OwnedNavigationBuilder.ts`, `builders/index.ts`
- `packages/migrations/src/snapshot/model-snapshot.ts`
- `packages/core/src/OwnedEntityHydrator.ts`, `index.ts`
- Tests: 5 new test files across metadata, orm, migrations, core, integration-tests

## Follow-up (P0-15)
Full LINQ query integration into JSON paths and eager materialization via EntityLoader.
