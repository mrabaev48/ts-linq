# P0-09: Cascade Delete Behaviors — Implementation Summary

**Status**: ✅ done  
**Branch**: feat/p0-09-cascade-delete-behaviors (merged to main via PR)  
**Packages touched**: @ts-linq/orm, @ts-linq/migrations

## What was implemented

### Already existed (no changes needed)
- `DeleteBehavior` enum (7 values) — `packages/types/src/index.ts`
- `RelationshipMetadata.onDelete?: DeleteBehavior` — `packages/types/src/index.ts`
- `onDelete()` methods on all three builder classes (ReferenceReferenceBuilder, ReferenceCollectionBuilder, CollectionReferenceBuilder) — `packages/orm/src/builders/`
- `buildInlineFkSql()` / `buildAddFkSql()` accepting `onDelete?: string` — `packages/migrations/src/builders/handlers/ForeignKeyHandlers.ts`

### New code added

#### `packages/migrations/src/builders/handlers/ForeignKeyHandlers.ts`
- Added `deleteBehaviorToSql(behavior: DeleteBehavior): string | undefined`
- Mapping: Cascade→'CASCADE', Restrict→'RESTRICT', SetNull→'SET NULL', NoAction→'NO ACTION'
- Client-side variants (ClientSetNull, ClientCascade, ClientNoAction) → `undefined` (no DB clause)

#### `packages/migrations/src/SchemaSnapshot.ts`
- `SchemaSnapshotBuilder.buildExpectedFromMetadata()` now populates `foreignKeys` from `RelationshipMetadata`
- Only `many-to-one` and `one-to-one` relationships with a `foreignKey` property generate FK defs
- Added `buildForeignKeys()` and `resolveTargetMeta()` private helpers
- `onDelete` clause is mapped via `deleteBehaviorToSql()` before storing in `ForeignKeyDef`

#### `packages/migrations/src/SchemaComparator.ts`
- Added `diffForeignKeys()` function comparing expected vs actual FK sets by fingerprint (sorted columns)
- `diffExistingTable()` now includes `fkCreates` and `fkDrops` in returned `TableDiff`

#### `packages/orm/src/changetracker/CascadeWalker.ts` (NEW FILE)
- `CascadeWalker` class with `walk(allTracked: Map<object, TrackedEntity>): void`
- Behavior matrix:
  - `Cascade` / `ClientCascade` → mark dependent entities `Deleted`, recurse
  - `SetNull` / `ClientSetNull` → set FK column to null, mark dependent `Modified`
  - `Restrict` / `NoAction` / `ClientNoAction` → no client-side action
- Cycle detection via `Set<string>` of `principalPk::fkColumn::dependentPk` visit keys
- Only processes `many-to-one` / `one-to-one` relationships that have a `foreignKey` defined

#### `packages/orm/src/ChangeTracker.ts`
- Added `applyCascades()` method — creates `CascadeWalker` and calls `walk()`

#### `packages/orm/src/DbContext.ts`
- `saveChanges()` now calls `this._changeTracker.applyCascades()` after `detectChanges()` and before `getChanges()`

### Exports added
- `packages/migrations/src/index.ts`: exports `deleteBehaviorToSql`, `buildInlineFkSql`, `buildAddFkSql`, `buildDropFkSql`, `buildCreateTableSql`
- `packages/migrations/src/builders/MigrationHandlers.ts`: re-exports `deleteBehaviorToSql`
- `packages/orm/src/index.ts`: exports `CascadeWalker`

## Tests added
- **Unit**: `packages/orm/tests/cascade-walker.test.ts` — tests for all 7 behaviors, recursive cascade, cycle detection, untracked entities
- **Integration**: `packages/integration-tests/tests-new/05-metadata-decorators/cascade-delete-behaviors.test.ts` — tests for DDL clause generation per dialect, fluent API wiring

## Architecture notes
- Client-side cascade only works for entities that are currently tracked in the ChangeTracker. If related entities are not loaded/tracked, DB-level constraints apply.
- `SchemaInspector` still returns `foreignKeys: []` for actual DB schema — so FK drops in existing tables are not auto-detected from DB inspection. New FK defs appear in `CREATE TABLE` DDL and in `ALTER TABLE ADD` migration steps when expected FK is not in actual snapshot.
- `ForeignKeyDef.onDelete` is stored as a plain SQL string (not enum) — mapping happens at SchemaSnapshot build time.
