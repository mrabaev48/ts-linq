# P0-07: Inheritance Mapping (TPH / TPT / TPC) — DONE

## Status: ✅ Completed (feat/p0-07-inheritance-tph-tpt-tpc)

## What was implemented

### New types — `@ts-linq/types`
- `InheritanceStrategy` enum: `Tph | Tpt | Tpc`
- `DiscriminatorEntry` interface: `{ ctor: Function; value: unknown }`
- `DiscriminatorMetadata` interface: `{ columnName, columnType, entries, isComplete }`
- `HierarchyMetadata` interface: `{ strategy, rootEntity, discriminator?, subtypes }`
- `EntityMetadata` extended with `hierarchy?: HierarchyMetadata` (root entity) and `hierarchyRoot?: Function` (subtypes)

### Metadata layer — `@ts-linq/metadata`
- `EntityMetadataBuilder.setHierarchy(h)` / `setHierarchyRoot(root)`
- `MetadataRegistry.setHierarchyMetadata(target, h)` / `setHierarchyRoot(subtype, root)`
- `MetadataStorage.setHierarchyMetadata()` / `setHierarchyRoot()` / `clear()` facade methods
- Re-exports: `InheritanceStrategy`, `HierarchyMetadata`, `DiscriminatorMetadata`, `DiscriminatorEntry` from `@ts-linq/types`

### ORM builders — `@ts-linq/orm`
- NEW: `DiscriminatorBuilder<TKey>` — fluent builder with `hasValue<TSub>(ctor, value)`, `isComplete(bool?)`, `_buildMetadata()`
- `EntityTypeBuilder.hasDiscriminator<TKey>(name, type?)` — returns `DiscriminatorBuilder`, sets strategy to Tph
- `EntityTypeBuilder.useTphMappingStrategy()` / `useTptMappingStrategy()` / `useTpcMappingStrategy()`
- `_applyToRegistry()` now writes hierarchy to registry and marks all subtypes with `hierarchyRoot`

### Query layer — `@ts-linq/query`
- `Queryable.ofType<TSub extends T>(ctor)` — strategy-aware filter:
  - **TPH**: appends `WHERE "disc_col" = ?` to `_model.where`
  - **TPT**: appends `INNER JOIN subtype_table ON base_table.pk = subtype_table.pk` to `_model.joins`
  - **TPC**: sets `_model.from = subtype_table_name`
- `RowMaterializer` — polymorphic dispatch: reads discriminator value from DB row, finds matching entry, instantiates correct concrete subtype via `materializeEntityWith(row, concreteCtor, meta)`

### Migration snapshot — `@ts-linq/migrations`
- `ModelSnapshotBuilder.buildFromMetadata()`:
  - **TPH**: adds discriminator column to root entity table
  - **TPT**: registers each subtype as a separate `ModelTableSnapshot` with its own columns + PK
  - **TPC**: replaces subtype table entry (partial columns) with full table (root columns + subtype columns)

## Files changed
- `packages/types/src/index.ts`
- `packages/metadata/src/EntityMetadata.ts`, `MetadataRegistry.ts`, `MetadataStorage.ts`, `index.ts`
- `packages/orm/src/builders/DiscriminatorBuilder.ts` (NEW), `EntityTypeBuilder.ts`, `builders/index.ts`
- `packages/query/src/Queryable.ts`, `RowMaterializer.ts`
- `packages/migrations/src/snapshot/model-snapshot.ts`
- `packages/types/tests/type-exports.test.ts` (updated expected exports)
- Tests: 5 new test files + 1 integration test

## Key design decisions
- `ofType()` creates a brand-new `Queryable<TSub>` using the same provider/services, then copies `_model` and applies strategy-specific modifications — no dialect changes needed
- Hierarchy metadata: root entity has full `hierarchy: HierarchyMetadata`; subtypes have `hierarchyRoot: Function` pointer to root — `ofType` looks up root via `hierarchyRoot`
- Polymorphic materialization only activates when root entity is queried directly (has `hierarchy.discriminator`); `ofType` queries already target a concrete subtype
- TPC snapshot fix: TPC subtype tables appear in the main entity loop with only their own columns; the TPC extra-tables loop replaces those entries with the full merged table (root + own columns)

## Test coverage
- `packages/metadata/tests/inheritance.test.ts` — 6 tests
- `packages/orm/tests/discriminator-builder.test.ts` — 5 tests
- `packages/orm/tests/entity-type-builder-inheritance.test.ts` — 6 tests
- `packages/query/tests/of-type.test.ts` — 6 tests
- `packages/migrations/tests/inheritance-snapshot.test.ts` — 5 tests
- `packages/integration-tests/tests-new/05-metadata-decorators/inheritance.test.ts` — 3 tests

## Follow-up
- P0-11 (Global query filters): discriminator WHERE clause composes correctly with existing global filter WHERE clauses — both append to `_model.where` array
- TPT insert/update split across tables in one transaction — deferred (not in P0-07 scope)
