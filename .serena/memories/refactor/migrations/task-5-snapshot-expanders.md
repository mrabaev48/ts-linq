# refactor migrations/task-5: snapshot builders → strategy expanders

✅ DONE — migrations' 5TH task (after 1,2,3,4). PR: `audit-refactor/migrations-snapshot-expanders`.

## What changed
Two parallel god-builders decomposed into thin coordinators + single-concern `EntityExpander`
strategies + one shared `ColumnMapper`. Global-registry coupling inverted via injected model.

### New: `packages/migrations/src/snapshot/expanders/`
- `ColumnMapper.ts` — SINGLE source of column→snapshot mapping: `toModelColumn(col, {isPrimaryKey?,namePrefix?,nullable?})` (raw type uppercased, always carries defaults), `toSchemaColumn(col,{isPrimaryKey?})` (portable type + `converter.toProvider` on default), `toSchemaShadowColumn(sp)`, and the single `mapPortableType`. (Old private `mapPortableType`/dead `normalizePortableType` removed from SchemaSnapshot.ts.)
- `EntityExpander.ts` — `interface EntityExpander<TTable,TColumn> { expand(ctx): void }` + `ExpansionContext<TTable,TColumn>` { entity, entityByType (ReadonlyMap<Function|string,EntityMetadata>), columns (mutable working array), tables (Map<name,TTable>), columnMapper }.
- `model/` (EntityExpander<ModelTableSnapshot,ModelColumnSnapshot>): `OwnedEntityExpander` (TableSplit/Json/SeparateTable), `ComplexTypeExpander` (recursive flatten), `InheritanceExpander` (TPH+TPT+TPC), `SkipNavigationExpander` (synthesized m2m join tables).
- `schema/` (EntityExpander<TableSnapshot,ColumnDef>): `ShadowPropertyExpander`, `TableFragmentExpander`; plus `SequenceExpander` (global `expand(sequences): SequenceDef[]`, NOT an EntityExpander) and `ForeignKeyResolver` (`resolve(entityMeta, entityByTarget)`, returns FKs — collaborator, not expander).

### Moved: `src/snapshot/model-snapshot.types.ts`
The 4 interfaces (ModelColumnSnapshot/ModelTableSnapshot/ModelIndexSnapshot/ModelSnapshot) extracted here and RE-EXPORTED from model-snapshot.ts (`export type {...}`). REASON: breaks the file-level cycle ColumnMapper↔model-snapshot that `madge --circular` (arch:cycles) would flag. Public surface unchanged (barrel still `export * from './snapshot/model-snapshot'`).

### Coordinators
- `ModelSnapshotBuilder`: `buildFromMetadata()` → `buildFrom(MetadataStorage.getEntities())`. `buildFrom(entities)` = entityByType (by target) → **sweep 1** base table per entity (`tables.set(tableName, base)`) → **sweep 2** ordered expanders with `ctx.columns = table.columns` → `finalize()` (centralized canonical sort: tables/columns/indexes/pks by name). TWO SWEEPS REQUIRED so TPC `tables.set(subtypeName, full)` overwrites the partial base table order-independently. Map<name,table> replaced array+extraTables (TPC replace = plain set; dedups duplicate names — matches `tableNames.filter().toHaveLength(1)`).
- `SchemaSnapshotBuilder`: `buildExpectedFromMetadata()` → `buildFrom(MetadataStorage.getEntities(), SequenceRegistry.getAll())`. `buildFrom(entities, sequences)` single pass (preserves order, NO table sort — schema was always insertion-order): keyless→view; base cols via toSchemaColumn; ShadowPropertyExpander appends to ctx.columns BEFORE merge; pks/indexes/uniqueConstraints inline; FKs via ForeignKeyResolver; table-split merge into tableMap; TableFragmentExpander per-entity after merge; SequenceExpander after loop. `buildActualFromProvider` UNCHANGED.

## Key facts / gotchas
- Two builders emit DIFFERENT column types (ModelColumnSnapshot vs ColumnDef) — "dedup" = two ColumnMapper methods, each killing intra-builder duplication (not cross-builder).
- Snapshot tests assert FIELD-LEVEL (`.find/.some/.type`), never `toStrictEqual` → uniform ColumnMapper always emitting `defaultValue`/`defaultExpression` (even undefined) is safe (JSON.stringify drops undefined; jest toEqual ignores undefined props).
- `SequenceMetadata` lives in `@ts-linq/types` (value-conversion.ts); `ValueConverter` type is actually `ValueConverterLike`.
- NO expander imports `@ts-linq/metadata` (verified by grep) — only ctx + injected data.
- Public API: builder classes/signatures unchanged; `buildFrom` is additive → **migrations minor 2.7.1→2.8.0** (+orm/cli patch as dependents).

## Validation — ALL GREEN
typecheck 32/32, lint 0 errors, unit 3574, integration 461 (+2 skipped), e2e 290, build 32/32, arch:deps clean, **arch:cycles no cycles**, arch:dead clean. Existing 47 snapshot tests pass UNCHANGED via no-arg path; +12 new expander/ColumnMapper/injected-model tests.

## Tech debt (in package README §task-5 follow-ups)
- Global-registry default path remains (no-arg methods) — remove once callers inject.
- Coordinates with task-6 (dialect-inspector selection): `buildActualFromProvider`'s postgresql/mysql/mssql `if`-dispatch left for task-6.
- ForeignKeyResolver + keyless-view routing + index/uniqueConstraint mapping kept in schema coordinator (not expanders) by scope.

Next migrations = task-6 (centralize dialect-inspector selection), then task-7.
