# P0-08: Many-to-Many with Skip Navigations — DONE

## Status: ✅ Completed (feat/p0-08-many-to-many-skip-navigations)

## What was implemented

### New types — `@ts-linq/types`
- `SkipNavigationMetadata` interface: `{ propertyName, targetEntity, joinTableName, joinEntityCtor, leftForeignKey, rightForeignKey, inverseSide?, isSynthesized }`
- `EntityMetadata` extended with `skipNavigations?: SkipNavigationMetadata[]`

### Metadata layer — `@ts-linq/metadata`
- `EntityMetadataBuilder.addSkipNavigation(nav)` — adds/replaces skip nav by propertyName
- `MetadataRegistry.mergeFluentSkipNavigation(target, nav)` — registers on builder or finalized entity
- `MetadataStorage.mergeFluentSkipNavigation()` — static forwarding
- Re-exports: `SkipNavigationMetadata` from `@ts-linq/types`

### ORM builders — `@ts-linq/orm`
- NEW: `CollectionCollectionBuilder<TLeft, TRight>` — returned by `withMany()`, has `usingEntity<TJoin>()` + `_applyToRegistry()`
- `CollectionNavigationBuilder.withMany()` now returns `CollectionCollectionBuilder` instead of `this`
- `EntityTypeBuilder` has `_skipNavBuilders` array; `hasMany()` passes it to CollectionNavigationBuilder
- `_applyToRegistry()` processes skip nav builders after primary keys are set
- `builders/index.ts` exports `CollectionCollectionBuilder`

### ChangeTracker — `@ts-linq/orm`
- `JoinRowChange` interface: `{ joinRow, joinEntityCtor, operation: 'insert' | 'delete' }`
- `_collectionSnapshots: Map<object, Map<string, Set<unknown>>>` — stores PK snapshots per entity
- `_snapshotCollections(entity, entityClass)` — private, reads skip navs, snapshots PKs
- `attach()` calls `_snapshotCollections` to store baseline
- `acceptAllChanges()` re-snapshots collections and clears deleted entries
- `clear()` clears `_collectionSnapshots`
- `collectSkipNavigationChanges(): JoinRowChange[]` — public, diffs current collections vs snapshots

### DbContext — `@ts-linq/orm`
- `saveChanges()` calls `_changeTracker.collectSkipNavigationChanges()` after entity changes
- `_applySkipNavigationChanges(changes)` — new private method, calls `provider.insert`/`provider.delete` for join rows

### Migration snapshot — `@ts-linq/migrations`
- `buildFromMetadata()` emits join table DDL for all `isSynthesized: true` skip navigations
- Deduplication by `joinTableName` to avoid double-emit (both sides reference same join table)

## Synthetic join entity strategy
`CollectionCollectionBuilder._applyToRegistry()` creates a synthetic named class via `createSyntheticClass(name)` (anonymous class with `Object.defineProperty(name)`), registers it in MetadataRegistry with proper tableName, columns (leftFk, rightFk), and composite PK. Provider uses `MetadataStorage.getEntity(syntheticCtor)` to find metadata for insert/delete.

## RelationshipLoader integration
Also registers `RelationshipMetadata` with `through: { table, sourceFk, targetFk }` on both sides. The existing `RelationshipLoader` in `@ts-linq/core` already handles `many-to-many` with `through` — so `include(p => p.tags)` works out-of-the-box via the existing batch-loading mechanism.

## Files changed
- `packages/types/src/index.ts`
- `packages/metadata/src/EntityMetadata.ts`, `MetadataRegistry.ts`, `MetadataStorage.ts`, `index.ts`
- `packages/orm/src/builders/CollectionCollectionBuilder.ts` (NEW)
- `packages/orm/src/builders/CollectionNavigationBuilder.ts`, `EntityTypeBuilder.ts`, `builders/index.ts`
- `packages/orm/src/ChangeTracker.ts`
- `packages/orm/src/DbContext.ts`
- `packages/migrations/src/snapshot/model-snapshot.ts`
- `project-documents/tasks/dev-plans/P0-08-many-to-many-skip-navigations.md` (status: done)
- `project-documents/tasks/dev-plans/README.md` (P0-08 marked done)
- `.changeset/p0-08-many-to-many-skip-navigations.md` (NEW)

## Tests
- `packages/orm/tests/collection-collection-builder.test.ts` — 9 unit tests
- `packages/orm/tests/skip-navigation-change-tracker.test.ts` — 6 unit tests
- `packages/metadata/tests/skip-navigation.test.ts` — 5 unit tests
- `packages/migrations/tests/skip-navigation-snapshot.test.ts` — 3 unit tests
- `packages/integration-tests/tests-new/05-metadata-decorators/skip-navigations.test.ts` — 8 integration tests

## Key design decisions
- Snapshot of collection PKs stored in separate `_collectionSnapshots` Map (not in TrackedEntity) to avoid changing shared `TrackedEntity` interface
- `RelationshipLoader` re-used for include() — no query-layer changes needed
- Stub relationship pushed by `withMany()` is replaced by the proper `through` relationship in `_applyToRegistry`
- Join entity is a synthetic class (not visible to user domain) registered dynamically in MetadataRegistry

## Follow-up
- P0-09 (Cascade delete): join table FKs need configurable cascade behaviors
- UsingEntity with extra columns (beyond leftFk/rightFk) — partially scaffolded, needs full implementation
