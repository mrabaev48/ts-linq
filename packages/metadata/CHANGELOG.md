# @ts-linq/metadata

## 4.1.5

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.6.0

## 4.1.4

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.5.0

## 4.1.3

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.4.0

## 4.1.2

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.3.0

## 4.1.1

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.2.0

## 4.1.0

### Minor Changes

- Inject `MetadataSource` into the loading layer (break the hidden `MetadataStorage` singleton coupling).

  `EntityLoader`, `RelationshipLoader`, and the `LazyLoadingProxy.create` / `createMany` /
  `preloadRelationships` entry points now resolve entity metadata from an injected `MetadataSource`
  port (reused from `@ts-linq/types`, implemented by `MetadataRegistry`) instead of reaching into the
  process-wide `MetadataStorage` global. `DbContext` wires `options.registry ?? MetadataStorage.getInstance()`
  into the loaders, so per-context / multi-tenant isolation now extends to relationship loading.

  Backward compatible: the new metadata parameter defaults to the global singleton (via the new
  `@deprecated` `getDefaultMetadataSource()` composition helper), so existing callers compile unchanged.
  A new `EmptyMetadataSource` Null Object is exported from `@ts-linq/metadata` for tests that need a
  guaranteed-empty source.

## 4.0.1

### Patch Changes

- Updated dependencies [416a1a6]
  - @ts-linq/types@4.1.0

## 4.0.0

### Major Changes

- [#169](https://github.com/mrabaev48/ts-linq/pull/169) [`6c1d403`](https://github.com/mrabaev48/ts-linq/commit/6c1d403078729a825c39af05bf4dc6ea8c9df644) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Replace the opaque `Function` entity-target type with real constructor types across the
  metadata API and the contracts that thread an entity class.

  **What changed**
  - **`@ts-linq/types`** — adds `EntityCtorRef` (`abstract new (...args: unknown[]) => unknown`):
    the constructor reference accepted by metadata **read/lookup** APIs. It rejects plain
    (non-constructor) functions but, unlike `EntityCtor` (`=> object`), also accepts projection
    element constructors such as the `new () => string` produced by `Queryable.select(x => x.name)`.
    The read/write metadata ports and the entity-class fields are narrowed off `Function`:
    - `MetadataSource` read methods (`getEntity`, `getValidationRules`, `getOwnedEntities`,
      `getStoredProcedureMapping`) → `EntityCtorRef`; `MetadataSink` write methods → `EntityCtor`.
    - `TrackedEntity.entityClass`, `EntityChangeContext.entityClass`,
      `FallbackRequest.entityClass`/`entity`, `EntityCacheLike` get/set/remove, and
      `EntityAttacher.attach` → `EntityCtorRef`.
  - **`@ts-linq/metadata`** — `MetadataRegistry`/`MetadataStorage` and the facet stores are keyed on
    `EntityCtor` (writes) / `EntityCtorRef` (reads). `Function` is eliminated from the package source
    (enforced by newly-enabled `@typescript-eslint/no-unsafe-function-type` and
    `no-unnecessary-type-assertion` rules); the only remaining `as unknown as` is the single audited
    `reflectUtils` capability probe. `EntityMetadataBuilder`'s internal state collapses to a single
    `Partial<EntityMetadata>`.
  - **`@ts-linq/core`** — `DatabaseProvider` CUD method parameters and the mapping decorators
    (`@Entity`, `@Column`, `@PrimaryKey`, relationships, `@Index`, `@ValidIf`) are narrowed off
    `Function`. Decorating a non-class (or a class with a required-argument constructor) is now a
    compile-time error.
  - **`@ts-linq/orm`**, **provider-mysql/postgres/mssql** — entity-class parameters/fields narrowed to
    match the contracts above.

  **Migration**

  Pass a class constructor reference (entity classes are parameterless) to metadata, provider, and
  decorator APIs. A bare `Function` value — or a plain (non-constructor) function — is no longer
  accepted and becomes a compile-time error. This only affects code that was previously passing
  non-constructor values, which was already incorrect at runtime.

### Patch Changes

- Updated dependencies [[`6c1d403`](https://github.com/mrabaev48/ts-linq/commit/6c1d403078729a825c39af05bf4dc6ea8c9df644)]:
  - @ts-linq/types@4.0.0

## 3.1.2

### Patch Changes

- [#167](https://github.com/mrabaev48/ts-linq/pull/167) [`ccd7235`](https://github.com/mrabaev48/ts-linq/commit/ccd72359ce15f46cca059afba1a2c39d5ea823f2) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Harden `MetadataRegistry.getEntity`: remove the silent `try/catch` control-flow fallback that
  could return un-rebased metadata on an unexpected error. Resolution now runs through a single
  documented reflect-metadata capability probe and a single guarded path that always applies
  `target` rebasing, so both wrapper and original targets yield the same metadata shape. The
  happy path is behaviour-preserving; the observable change is that a previously-swallowed
  unexpected resolution error now surfaces as a typed `MetadataError` (with its original `cause`
  chained) instead of vanishing.

## 3.1.1

### Patch Changes

- [#164](https://github.com/mrabaev48/ts-linq/pull/164) [`32cda43`](https://github.com/mrabaev48/ts-linq/commit/32cda43913c6a701add02b0171c4a399147b3d26) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Internal restructure of `MetadataRegistry` (behaviour-preserving, no public API change). The
  duplicated "finalized-vs-builder" branch across ~27 mutators is collapsed into a single
  `EntityMetadataState.mutate` Template Method, index dedup/unknown-column validation is unified into
  one `validateIndex` helper used by both states, and the mutators are grouped into cohesive internal
  facet stores composed behind the unchanged `MetadataRegistry` facade.

## 3.1.0

### Minor Changes

- [#162](https://github.com/mrabaev48/ts-linq/pull/162) [`40a71ed`](https://github.com/mrabaev48/ts-linq/commit/40a71ed3079bdf86492e9f27a226470a3985f39e) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Introduce the `MetadataSource` (read) and `MetadataSink` (write) ports for entity metadata.
  - `@ts-linq/types` now exports two new interfaces: `MetadataSource` (read-only:
    `getEntity`, `getEntities`, `getValidationRules`, `getOwnedEntities`,
    `getStoredProcedureMapping`) and `MetadataSink` (the full registration/write surface).
    They apply Ports-and-Adapters + Interface Segregation so consumers depend on an
    abstraction instead of the `MetadataStorage` global singleton or the concrete
    `MetadataRegistry`.
  - `@ts-linq/metadata`'s `MetadataRegistry` now `implements MetadataSource, MetadataSink`
    (no behaviour change — signatures mirror the existing methods), and both ports are
    re-exported from the package entrypoint. `MetadataStorage`'s static API and decorator
    registration are unchanged and fully backward compatible; it is now documented as the
    default-source provider only.

  Additive and backward compatible. Prerequisite for the core loader dependency-injection
  refactor (`core/task-2`).

### Patch Changes

- Updated dependencies [[`40a71ed`](https://github.com/mrabaev48/ts-linq/commit/40a71ed3079bdf86492e9f27a226470a3985f39e)]:
  - @ts-linq/types@3.1.0

## 3.0.0

### Major Changes

- [#152](https://github.com/mrabaev48/ts-linq/pull/152) [`5995782`](https://github.com/mrabaev48/ts-linq/commit/5995782a9f1c7449d7ad457a8cf1700cd80b9c0d) Thanks [@mrabaev48](https://github.com/mrabaev48)! - refactor(types): replace `Function` with `EntityCtor`/`EntityRef` in the shared metadata model

  Tightens the weak `Function` / `Function | (() => Function)` entity-target types in the shared
  metadata model so wrong (non-constructor) values no longer compile, and downstream packages can
  drop their `as unknown as` casts.

  `@ts-linq/types` now exports two type-only aliases from `metadata.ts` (via the barrel):
  - `type EntityCtor = abstract new (...args: unknown[]) => object`
  - `type EntityRef = EntityCtor | (() => EntityCtor)`

  These replace `Function` in `EntityMetadata.target`/`hierarchyRoot`,
  `RelationshipMetadata.targetEntity` (now `string | EntityRef | undefined`),
  `RelationshipOptions.targetEntity`, `DiscriminatorEntry.ctor`,
  `HierarchyMetadata.rootEntity`/`subtypes`, `OwnedEntityMetadata.ownedType`, and both
  `SkipNavigationMetadata` constructor fields. A plain function or arrow function is no longer
  assignable to these fields.

  **Breaking.** Narrowing the type of exported metadata-interface fields is a breaking change for
  any external consumer that assigned a non-constructor. In lockstep, `@ts-linq/core`,
  `@ts-linq/metadata` and `@ts-linq/orm` narrowed coordinated public signatures — the relationship
  decorators (`OneToMany`/`ManyToOne`/`OneToOne`/`ManyToMany` now take `() => EntityCtor`),
  `loadCompiledModel`/`CompiledModelClassMap`/`DbContextOptions.compiledModelClassMap` (now
  `Record<string, EntityCtor>`), and the fluent model-builder entity generics (now constrained
  `<T extends object>`). These are source-compatible for all conforming code (entity classes are
  constructors and objects); only previously-invalid usage stops compiling. No runtime behaviour
  changes — the aliases erase at compile time.

### Patch Changes

- Updated dependencies [[`5995782`](https://github.com/mrabaev48/ts-linq/commit/5995782a9f1c7449d7ad457a8cf1700cd80b9c0d)]:
  - @ts-linq/types@3.0.0

## 2.7.3

### Patch Changes

- Updated dependencies [[`fcc484a`](https://github.com/mrabaev48/ts-linq/commit/fcc484a7e9c13f53c30a9e9beac62baf7c616f85)]:
  - @ts-linq/types@2.12.1

## 2.7.2

### Patch Changes

- Updated dependencies [[`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f)]:
  - @ts-linq/types@2.12.0

## 2.7.1

### Patch Changes

- Updated dependencies [[`2df83e5`](https://github.com/mrabaev48/ts-linq/commit/2df83e5c5c49a1c4be98748905fdf2d9511b4d56)]:
  - @ts-linq/types@2.11.1

## 2.7.0

### Minor Changes

- [#141](https://github.com/mrabaev48/ts-linq/pull/141) [`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-21): implement Sequences and HiLo — ModelBuilder.hasSequence(), PropertyBuilder.useHiLo()/useSequence(), HiLoValueGenerator with per-context block reservation, native CREATE SEQUENCE DDL for PostgreSQL/MSSQL, counter-table emulation for MySQL, full schema diff and migration support

### Patch Changes

- Updated dependencies [[`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6)]:
  - @ts-linq/types@2.11.0

## 2.6.2

### Patch Changes

- Updated dependencies [[`f03dbf1`](https://github.com/mrabaev48/ts-linq/commit/f03dbf1d4c9ee5f10faf70a3d87babc638918508)]:
  - @ts-linq/types@2.10.0

## 2.6.1

### Patch Changes

- Updated dependencies [[`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252)]:
  - @ts-linq/types@2.9.0

## 2.6.0

### Minor Changes

- [#135](https://github.com/mrabaev48/ts-linq/pull/135) [`a3c75aa`](https://github.com/mrabaev48/ts-linq/commit/a3c75aab0b5c3304f0e4bf3c6471f74ee9e4f580) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-44): implement compiled models / AOT optimization
  - `@ts-linq/metadata`: adds `CompiledModel` interface and `loadCompiledModel()` hydration service
  - `@ts-linq/orm`: DbContext pre-populates MetadataRegistry from `compiledModel` option, skipping reflective decorator scan
  - `@ts-linq/cli`: new `dbcontext optimize` command generates `.generated.ts` AOT snapshots; `--check` flag for CI drift detection

## 2.5.1

### Patch Changes

- Updated dependencies [[`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0)]:
  - @ts-linq/types@2.8.0

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
