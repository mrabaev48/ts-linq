# @ts-linq/metadata

## 2.5.0

### Minor Changes

- [#131](https://github.com/mrabaev48/ts-linq/pull/131) [`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-33): implement stored procedure mapping for Insert/Update/Delete operations

  Adds `insertUsingStoredProcedure()`, `updateUsingStoredProcedure()`, and `deleteUsingStoredProcedure()`
  fluent API on `EntityTypeBuilder<T>`. When configured, `SaveChanges` routes entity CUD operations
  to dialect-specific CALL/EXEC statements instead of inline DML. Supports input/output parameters,
  original-value parameters, and rows-affected via result column, OUT parameter, or return value.
  Implemented for PostgreSQL (CALL), MySQL (CALL + follow-up SELECT), and MSSQL (EXEC).

### Patch Changes

- Updated dependencies [[`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54)]:
  - @ts-linq/types@2.7.0

## 2.4.0

### Minor Changes

- [#129](https://github.com/mrabaev48/ts-linq/pull/129) [`1a0d098`](https://github.com/mrabaev48/ts-linq/commit/1a0d098baa3e18f406eafae8281ee7daf442cdea) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-32): implement backing fields and property access mode
  - Add `PropertyAccessMode` enum (`Property` | `Field` | `FieldDuringConstruction`) to `@ts-linq/metadata`
  - Add `PropertyAccessor<T>` interface and `createPropertyAccessor` / `defaultPropertyAccessor` factory to `@ts-linq/metadata`
  - Add `hasField(fieldName)` and `usePropertyAccessMode(mode)` to `PropertyBuilder` — mirrors EF Core's API
  - Add entity-level `usePropertyAccessMode(mode)` to `EntityTypeBuilder` — default for all properties, overridable per-property
  - Extend `ColumnMetadata` with `fieldName?`, `accessMode?`, `accessor?` fields
  - Update `RowMaterializer` to call `accessor.constructionSet` during hydration — bypasses setter invariants when configured
  - Update `ChangeTracker.hasChanged` and `cloneObject` to read property values through `accessor.get` / `accessor.set`
  - Default behavior when only `hasField()` is provided: `FieldDuringConstruction` (hydration bypasses setter, user mutations go through setter)
  - No breaking changes — all existing code defaults to `Property` mode (previous behavior)

### Patch Changes

- Updated dependencies [[`1a0d098`](https://github.com/mrabaev48/ts-linq/commit/1a0d098baa3e18f406eafae8281ee7daf442cdea)]:
  - @ts-linq/types@2.6.0

## 2.3.0

### Minor Changes

- [#127](https://github.com/mrabaev48/ts-linq/pull/127) [`4c6abea`](https://github.com/mrabaev48/ts-linq/commit/4c6abead6c23c96d3faa01c4f12368f92ed935f5) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-31): implement alternate keys and rich indexes
  - Add `hasAlternateKey(selector)` to EntityTypeBuilder — emits named UNIQUE constraints usable as FK targets
  - Add `includeProperties(selector)` and `isDescending(flags[])` to IndexBuilder — covering indexes and per-column sort order
  - Add lambda-selector overload to `hasIndex(selector)` — mirrors EF Core's API
  - Wire `hasPrincipalKey()` → alternate key FK resolution in SchemaSnapshot
  - Add `AlternateKeyMetadata` type and `alternateKeys` field to `EntityMetadata`
  - Add `UniqueConstraintDef` to DiffTypes; diff + DDL emit alternate keys separately from plain indexes
  - All dialects: `generateAddUniqueConstraintSql` / `generateDropUniqueConstraintSql`
  - PostgreSQL covering indexes via INCLUDE clause
  - MySQL: hasFilter silently dropped with warning (not supported natively)

### Patch Changes

- Updated dependencies [[`4c6abea`](https://github.com/mrabaev48/ts-linq/commit/4c6abead6c23c96d3faa01c4f12368f92ed935f5)]:
  - @ts-linq/types@2.5.0

## 2.2.0

### Minor Changes

- [#117](https://github.com/mrabaev48/ts-linq/pull/117) [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-11): Add global query filters with EF9 named-filter support

  Adds model-level named query filters (`hasQueryFilter`) on `EntityTypeBuilder<T>` and
  per-query opt-out (`ignoreQueryFilters()`) on `DbSet<T>` / `Queryable<T>`, matching
  EF Core 9 semantics.
  - **`@ts-linq/types`**: New `QueryFilterMetadata` interface.
  - **`@ts-linq/metadata`**: `EntityMetadataBuilder.addQueryFilter()` and `MetadataRegistry.mergeFluentQueryFilter()`.
  - **`@ts-linq/orm`**: `EntityTypeBuilder.hasQueryFilter(pred)` / `hasQueryFilter(name, pred)` (transformer-compiled), `DbSet.ignoreQueryFilters()`, `ModelBuilder` exposes per-context filter map.
  - **`@ts-linq/query`**: `Queryable.ignoreQueryFilters()`, `GlobalFilterApplier` applies per-context filters at query time.
  - **`@ts-linq/transformer`**: Rewrites `hasQueryFilter(lambda)` → `hasQueryFilterCompiled(ast, params)` at compile time (same mechanism as `where()`).

- [#118](https://github.com/mrabaev48/ts-linq/pull/118) [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-13): add HasData model seeding with migration diff support

  Implements EF Core-compatible `hasData(...rows)` on `EntityTypeBuilder<T>`. Seed rows are stored in `EntityMetadata`, included in `ModelSnapshot`, and diffed by primary key between snapshots to emit precise INSERT / UPDATE / DELETE statements in the same migration transaction as DDL. Topological sort ensures FK-safe apply order.

- [#119](https://github.com/mrabaev48/ts-linq/pull/119) [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-14): add HasComputedColumnSql, HasCheckConstraint, HasComment fluent API
  - PropertyBuilder: hasComputedColumnSql(sql, options?) sets isComputed/computedExpression/computedStorage
  - PropertyBuilder: hasComment(comment) stores column-level documentation
  - EntityTypeBuilder: hasCheckConstraint(name, sql) declares CHECK constraints
  - EntityTypeBuilder: hasComment(comment) stores table-level documentation
  - CheckConstraintMetadata interface added to @ts-linq/types
  - ColumnMetadata extended with comment and computedStorage fields
  - EntityMetadata extended with checkConstraints and comment fields
  - SchemaSnapshot applies value converter to defaultValue during ColumnDef construction
  - All three dialects emit CHECK constraints inline in CREATE TABLE
  - PostgresDdlStrategy/MssqlDdlStrategy: generateCommentSql() emits COMMENT ON / sp_addextendedproperty
  - MySQL: column comments emitted inline, table comments in CREATE TABLE options

- [#120](https://github.com/mrabaev48/ts-linq/pull/120) [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-16): shadow properties — declare DB columns without entity class fields
  - ShadowPropertyMetadata interface added to @ts-linq/types
  - EntityMetadata extended with optional shadowProperties: Map<string, ShadowPropertyMetadata>
  - ColumnMetadata extended with optional isShadow flag
  - EntityTypeBuilder: property<T>(name: string) overload registers shadow properties
  - MetadataRegistry.addShadowProperty() and EntityMetadataBuilder.addShadowProperty()
  - ChangeTracker: \_shadowValues WeakMap for per-entity shadow value storage
  - ChangeTracker: getShadowValue / setShadowValue / getShadowValues public API
  - ChangeTracker.detectChanges() marks entity Modified when shadow values change
  - PropertyEntry<TValue> class with currentValue getter/setter
  - EntityEntry.property<T>(name) returns PropertyEntry backed by ChangeTracker
  - DbContext.entry<T>(entity) public method returning a fully-initialized EntityEntry
  - DbContext.normalizeChange() merges shadow values into entity record before INSERT/UPDATE
  - EF.property<TValue>(entity, name) compile-time marker for LINQ shadow column access
  - SchemaSnapshot.buildExpectedFromMetadata() includes shadow columns in DDL output

- [#122](https://github.com/mrabaev48/ts-linq/pull/122) [`cda8a4e`](https://github.com/mrabaev48/ts-linq/commit/cda8a4edac105bffd343fe8637f0340c361486e2) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-25): implement table splitting and entity splitting

  Introduces `TableFragmentMetadata` and `EntityMetadata.tableFragments` allowing one entity to be spread across multiple physical tables (entity splitting) and multiple entities to share a single table (table splitting).

  Public API additions:
  - `EntityTypeBuilder.splitToTable(tableName, configure, schema?)` — maps secondary properties of an entity to a separate table
  - `TableSplitConfigBuilder.property(selector)` — configures which properties go into the fragment table
  - `FragmentJoinPlanner.plan(meta)` — auto-generates INNER JOIN clauses for fragment tables in SELECT queries
  - Two or more entities calling `.toTable()` with the same name merge into a single DDL table (table splitting)

  Migration DDL now emits separate `CREATE TABLE` statements for each fragment. `SaveChanges` issues per-fragment INSERT/UPDATE/DELETE within the same transaction. Queries auto-join fragment tables via `FragmentJoinPlanner`.

- [#123](https://github.com/mrabaev48/ts-linq/pull/123) [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Add `toView()`, `hasNoKey()`, and `hasViewSql()` for mapping entities to database views as keyless (read-only) types. Keyless entities are never tracked, throw `KeylessMutationError` on mutations, and query via `FROM viewName` in all dialects.

- [#125](https://github.com/mrabaev48/ts-linq/pull/125) [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-30): Add value generators and sentinel (EF8)

  Introduces pluggable client-side value generation and sentinel-based "not-set" detection, mirroring EF Core's `ValueGeneratedOnAdd` / `HasValueGenerator` / `HasSentinel` API.
  - **`@ts-linq/types`**: New `ValueGeneratedPolicy` enum (`Never`, `OnAdd`, `OnUpdate`, `OnAddOrUpdate`), `ValueGenerator<T>` interface, `ValueGeneratorClass<T>` type, `ValueGeneratorContext` interface. Extended `ColumnMetadata` with `valueGeneratedPolicy`, `sentinel`, and `valueGeneratorClass` fields.
  - **`@ts-linq/metadata`**: Re-exports all four new symbols from `@ts-linq/types`.
  - **`@ts-linq/orm`**: Six new `PropertyBuilder<T>` methods — `valueGeneratedOnAdd()`, `valueGeneratedOnUpdate()`, `valueGeneratedOnAddOrUpdate()`, `valueGeneratedNever()`, `hasValueGenerator(cls)`, `hasSentinel(value)`. Three built-in generators — `UlidValueGenerator`, `UuidV7ValueGenerator`, `UtcNowValueGenerator`. `DbContext.prefillDefaults()` extended to invoke client-side generators before INSERT/UPDATE using sentinel-aware comparison. `BatchGrouper.calcParamsPerRow()` updated to correctly exclude DB-side generated columns from INSERT parameter lists.

### Patch Changes

- Updated dependencies [[`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7), [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8), [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3), [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b), [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795), [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907)]:
  - @ts-linq/types@2.4.0

## 2.1.0

### Minor Changes

- cd77e1f: feat(p0-05): add ValueConverter, ValueComparer and HasConversion fluent API

  Adds bidirectional model↔provider value conversion (EF Core HasConversion parity):
  - `ValueConverter<TModel, TProvider>` and `ValueComparer<T>` concrete classes in `@ts-linq/metadata`
  - Built-in converters: `BoolToZeroOneConverter`, `EnumToStringConverter`, `EnumToNumberConverter`, `DateOnlyToStringConverter`
  - `PropertyBuilder.hasConversion()` fluent overloads (converter instance or function pair + optional comparer)
  - `ModelBuilder.properties<T>().haveConversion()` for global type-level converters
  - `ChangeTracker.detectChanges()` uses `ValueComparer.equals/snapshot` for reference-type properties
  - `RowMaterializer` applies `fromProvider` on read; all dialects and providers apply `toProvider` on write
  - `BinaryVisitor` lifts converter to literals in WHERE predicates
  - Bug fix: `MetadataRegistry.registerEntity` no longer overwrites finalized entities when called without a table name

- 7745012: feat(p0-06): add OwnedEntityTypes — OwnsOne, OwnsMany, ToJson, table-splitting
  - `StorageStrategy` enum (TableSplit | SeparateTable | Json) in `@ts-linq/types`
  - `OwnedEntityMetadata` interface + `EntityMetadata.ownedEntities` field
  - `MetadataRegistry.addOwnedEntity()` / `getOwnedEntities()` in `@ts-linq/metadata`
  - New `OwnedNavigationBuilder<TOwner, TOwned>` in `@ts-linq/orm` with `property()`, `withOwner()`, `hasForeignKey()`, `hasKey()`, `toTable()`, `toJson()`
  - `EntityTypeBuilder.ownsOne()` / `ownsMany()` on existing builder
  - `ModelSnapshotBuilder` expands owned columns (TableSplit prefixed columns, Json column, SeparateTable extra table)
  - `hydrateTableSplit` / `hydrateJson` / `hydrateOwnedEntities` materialization utilities in `@ts-linq/core`

- 90402db: feat(p0-07): add inheritance mapping — TPH, TPT, TPC
  - New `InheritanceStrategy` enum, `HierarchyMetadata`, `DiscriminatorMetadata` types in `@ts-linq/types`
  - `EntityMetadata` extended with `hierarchy?` (root) and `hierarchyRoot?` (subtype) fields
  - `MetadataRegistry`/`MetadataStorage` gain `setHierarchyMetadata()` and `setHierarchyRoot()` methods
  - New `DiscriminatorBuilder<TKey>` fluent builder with `hasValue()` and `isComplete()` — mirrors EF Core API
  - `EntityTypeBuilder` gains `hasDiscriminator()`, `useTphMappingStrategy()`, `useTptMappingStrategy()`, `useTpcMappingStrategy()`
  - `Queryable.ofType<TSub>(ctor)` filters the query: TPH adds WHERE on discriminator, TPT adds INNER JOIN, TPC changes FROM table
  - `RowMaterializer` performs polymorphic dispatch — reads discriminator value from DB row and instantiates the correct concrete subtype
  - `ModelSnapshotBuilder` emits DDL-correct snapshots: TPH adds discriminator column, TPT registers subtype tables, TPC builds full leaf tables with inherited columns

- 240059c: feat(p0-08): implement many-to-many skip navigations — HasMany().WithMany(), UsingEntity<T>, SkipNavigationMetadata, ChangeTracker collection diffing, migration join table DDL
- b738384: feat(temporal): add SQL Server system-versioned table query operators (P2-36)

  Implements all five EF Core temporal operators for SQL Server system-versioned (temporal) tables:
  - `temporalAsOf(date)` — `FOR SYSTEM_TIME AS OF @p`
  - `temporalAll()` — `FOR SYSTEM_TIME ALL`
  - `temporalBetween(from, to)` — `FOR SYSTEM_TIME BETWEEN @p1 AND @p2`
  - `temporalFromTo(from, to)` — `FOR SYSTEM_TIME FROM @p1 TO @p2`
  - `temporalContainedIn(from, to)` — `FOR SYSTEM_TIME CONTAINED IN (@p1, @p2)`

  All five operators are available on both `Queryable<T>` and `DbSet<T>` and are chainable with any other LINQ operator.

  **`@ts-linq/types`**: added `TemporalMode`, `TemporalClause`, `TemporalNotSupportedError`; extended `QueryOptions` with `temporal?` and `EntityMetadata` with `isTemporal?`/`historyTableName?`.

  **`@ts-linq/query`**: `Queryable<T>` temporal methods; `QueryModel.temporal` field; `QueryBuilder.generateFromModel` now correctly passes `from` and `temporal` to `QueryOptions`.

  **`@ts-linq/orm`**: `DbSet<T>` temporal delegates; `EntityTypeBuilder.isTemporal()` and `withHistoryTable(name)` fluent config.

  **`@ts-linq/metadata`**: `EntityMetadataBuilder.setTemporal/setHistoryTableName`; `MetadataRegistry.mergeFluentTemporal`.

  **`@ts-linq/dialect-mssql`**: new `emit-temporal.ts` with `buildTemporalClause`; integrated into `MssqlDialect.buildSelect`.

  **`@ts-linq/dialect-postgres` / `@ts-linq/dialect-mysql`**: throw `TemporalNotSupportedError` when `options.temporal` is set (mirrors EF Core restriction).

### Patch Changes

- Updated dependencies [51516f8]
- Updated dependencies [cd77e1f]
- Updated dependencies [7745012]
- Updated dependencies [90402db]
- Updated dependencies [240059c]
- Updated dependencies [2f86a0d]
- Updated dependencies [b738384]
- Updated dependencies [6cad9cf]
- Updated dependencies [d0668cb]
  - @ts-linq/types@2.3.0

## 2.0.2

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/types@2.2.0

## 2.0.1

### Patch Changes

- Updated dependencies [[`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/types@2.1.0

## 2.0.0

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/types@2.0.0
