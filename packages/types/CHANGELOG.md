# @ts-linq/types

## 4.4.0

### Minor Changes

- Move raw SQL identifier assembly out of `Queryable` into the dialect layer (query/task-6).
  - **Cross-dialect correctness (MySQL fix):** `ofType` (TPH/TPT) and join construction no longer
    emit hardcoded ANSI double-quote (`"`) identifiers. Identifier quoting is now the dialect's
    responsibility, so MySQL renders backticks and SQL Server renders brackets correctly.
  - **`whereInSubquery` correctness:** the column is now resolved to its mapped name
    (`@Column({ name })`) and quoted via the dialect before emission, instead of interpolating the
    raw TypeScript property key.
  - **Structured join model (`@ts-linq/types`):** `JoinClause` gains `onColumns`
    (`JoinOnCondition[]` of table-qualified `JoinColumnRef`s); the dialect renders and quotes them.
    The pre-rendered `on` string is now optional and `@deprecated`, retained as a
    backward-compatible fallback.
  - **`@ts-linq/sql-visitor`:** new public `renderJoinOn` helper renders structured join conditions
    with an injected `quoteIdentifier`; `FragmentJoinPlanner` now emits `onColumns` (fixing the same
    hardcoded-`"` portability bug in entity-splitting fragment joins).
  - **Subquery parameter ordering:** `whereExists`/`whereInSubquery` now normalize a spliced
    subquery's placeholders back to positional `?`, so the dialect's single global `?`→`$N`/`@pN`
    renumbering keeps outer and subquery parameters correctly aligned.

## 4.3.0

### Minor Changes

- Fix silent/over-broad catch blocks in the query execution path (security + correctness).

  **Security fix (headline):** `GlobalFilterApplier` no longer silently drops a named query
  filter that fails to compile. A swallowed tenant-isolation / soft-delete filter could
  under-filter a query and **leak rows it was meant to hide**. Compilation failures now fail
  closed, throwing the new typed `QueryFilterCompilationError` (with the original failure
  preserved as `cause` and the filter name in `details`).

  **Fallback exhaustion is now observable:** when the hedged select race loses the primary AND
  every fallback source fails, the executor throws the new `FallbackExhaustedError` (primary
  error preserved as `cause`, per-source failures in `details.errors`) instead of returning a
  silently-empty result. "All fallbacks failed" is now distinguishable from "no fallback
  configured", and the fallback sources are attempted at most once.

  **Uniform telemetry logging:** all remaining "ignore" telemetry/degradation catches
  (`RowMaterializer` cache-size / materialization notifications, fallback `populateIncludes`,
  the count-race) are routed through the single `logInternalError` seam — they never break
  materialization or execution.

  **Include proxy no longer double-invokes:** a throwing `include()` lambda now surfaces its
  error after a single invocation instead of re-running the user lambda (no duplicated side
  effects).

  New error types added to `@ts-linq/types`: `QueryFilterCompilationError`
  (`QUERY_FILTER_COMPILATION_ERROR`) and `FallbackExhaustedError` (`FALLBACK_EXHAUSTED`).

## 4.2.0

### Minor Changes

- Surface previously-swallowed failures on the core execution and loading hot paths.
  - **`@ts-linq/types`**: add three typed errors to the `OrmError` hierarchy —
    `EntityNotFoundError` (`ENTITY_NOT_FOUND`), `OwnedEntityHydrationError`
    (`OWNED_ENTITY_HYDRATION_ERROR`) and `RelationshipLoadError`
    (`RELATIONSHIP_LOAD_ERROR`).
  - **`@ts-linq/core`** (behavioural correctness fixes):
    - `DatabaseProvider.upsert` no longer treats _any_ update error as "row absent".
      It now falls back to INSERT only on the typed `EntityNotFoundError` signal;
      deadlocks, optimistic-concurrency conflicts, validation and connection errors
      propagate instead of spuriously inserting a duplicate row.
    - `OwnedEntityHydrator.hydrateJson` throws a typed `OwnedEntityHydrationError`
      (with `cause` + safe context) on a corrupt JSON column instead of silently
      returning `undefined` and dropping the owned entity.
    - `EntityLoader.loadRelationshipByType` now propagates a typed
      `RelationshipLoadError` when a relationship load fails, so callers can no
      longer receive a silently half-populated entity.
    - Remaining intentional swallows (logger isolation, telemetry, stage-3 init)
      are routed through the single `logInternalError` channel instead of being
      dropped silently.

## 4.1.0

### Minor Changes

- 416a1a6: Security: close the SQL-injection vector in `RelationshipLoader` junction (many-to-many) reads.

  `@ts-linq/core` no longer builds raw, string-interpolated SQL in the loading layer. Junction
  reads now go through a new dialect-aware provider capability,
  `DatabaseProvider.queryJunction(spec: JunctionQuerySpec)`, which validates every identifier
  (`^[A-Za-z_][A-Za-z0-9_]*$`, failing closed with the new typed `InvalidIdentifierError`) and
  quotes it via the dialect's `quoteIdentifier`, while binding all filter values as parameters.
  Providers inherit this safe default; no provider override is required.

  `@ts-linq/types` adds two new public exports: the `JunctionQuerySpec` interface and the
  `InvalidIdentifierError` error class (with the new `OrmErrorCode.InvalidIdentifier` /
  `'INVALID_IDENTIFIER'` code).

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

## 2.12.1

### Patch Changes

- [#150](https://github.com/mrabaev48/ts-linq/pull/150) [`fcc484a`](https://github.com/mrabaev48/ts-linq/commit/fcc484a7e9c13f53c30a9e9beac62baf7c616f85) Thanks [@mrabaev48](https://github.com/mrabaev48)! - refactor(types): isolate runtime values (ok/err/guards) and enums into dedicated modules; barrel surface unchanged

  Internal reorganization of `@ts-linq/types`: the runtime helpers `ok`, `err` and
  `isTemplateSqlCache` now live in `src/runtime.ts`, and the seven value-emitting enums
  (`EntityState`, `LoadingStrategy`, `ValueGeneratedPolicy`, `DeleteBehavior`, `StorageStrategy`,
  `InheritanceStrategy`, `QuerySplittingBehavior`) now live in `src/enums.ts`. Both modules are
  re-exported from the `index.ts` barrel, so every previously exported name remains exported with
  identical type and runtime identity — no consumer changes required. Enums are kept as regular
  (non-`const`) string enums; cross-package `const enum` inlining is unsafe under the monorepo's
  separate per-package builds.

## 2.12.0

### Minor Changes

- [#148](https://github.com/mrabaev48/ts-linq/pull/148) [`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(types): add OrmError root, OrmErrorCode enum, and standardized error hierarchy; backward-compatible

  Introduce an abstract `OrmError` root carrying a stable machine-readable `code`, an optional
  structured `details` payload, and a preserved `cause` chain. All existing error classes
  (`DatabaseError`, `OptimisticConcurrencyError`, `UniqueConstraintError`,
  `ForeignKeyConstraintError`, `ValidationError`, `TemporalNotSupportedError`) are re-rooted under
  `OrmError`, so a single `if (e instanceof OrmError)` now catches every ORM failure. Existing class
  names, constructor signatures, and `instanceof` checks are unchanged — this is purely additive.

  New exported categories (for downstream typed throws): `UnsupportedOperationError`,
  `MetadataError`, `DecoratorUsageError`, `BatchConfigurationError`, `InvalidIncludeError`,
  `OperationAbortedError`. Also exports `OrmErrorCode` (const-object union of stable codes) and the
  `OrmErrorOptions` type.

## 2.11.1

### Patch Changes

- [#147](https://github.com/mrabaev48/ts-linq/pull/147) [`2df83e5`](https://github.com/mrabaev48/ts-linq/commit/2df83e5c5c49a1c4be98748905fdf2d9511b4d56) Thanks [@mrabaev48](https://github.com/mrabaev48)! - refactor: split 1275-line index.ts barrel into cohesive concern modules (no public API change)

  The 1275-line mega-barrel `packages/types/src/index.ts` has been reorganized into 15 focused
  concern modules: `sql.ts`, `logging.ts`, `dialect.ts`, `middleware.ts`, `config.ts`,
  `query-filters.ts`, `results.ts`, `cache.ts`, `value-conversion.ts`, `metadata.ts`,
  `stored-procedure.ts`, `tracking.ts`, `spatial-hierarchy.ts`, `diagnostics.ts`, `scaffolding.ts`.
  `index.ts` is now a thin re-export barrel. All previously exported names remain available at
  `@ts-linq/types` — zero consumer changes required.

## 2.11.0

### Minor Changes

- [#141](https://github.com/mrabaev48/ts-linq/pull/141) [`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-21): implement Sequences and HiLo — ModelBuilder.hasSequence(), PropertyBuilder.useHiLo()/useSequence(), HiLoValueGenerator with per-context block reservation, native CREATE SEQUENCE DDL for PostgreSQL/MSSQL, counter-table emulation for MySQL, full schema diff and migration support

## 2.10.0

### Minor Changes

- [#139](https://github.com/mrabaev48/ts-linq/pull/139) [`f03dbf1`](https://github.com/mrabaev48/ts-linq/commit/f03dbf1d4c9ee5f10faf70a3d87babc638918508) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-17): implement Complex Types — ComplexProperty value-object semantics without identity

  Adds `complexProperty()` API mirroring EF Core 8's `ComplexProperty`. Complex type columns
  are flattened into the owner table (e.g. `shippingAddress_street`), detected via deep-value
  equality in ChangeTracker, and rewritten to flat column names in the SQL visitor.

  New exports: `ComplexTypePropertyMetadata` (types), `ComplexTypeBuilder` (orm),
  `ComplexAccessRewriter` (sql-visitor). `EntityMetadata.complexProperties` field added.

## 2.9.0

### Minor Changes

- [#137](https://github.com/mrabaev48/ts-linq/pull/137) [`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-15): implement JSON columns — OwnsOne/OwnsMany with ToJson(), LINQ querying into JSON paths, per-dialect SQL translation (Postgres JSONB, MySQL JSON, MSSQL JSON_VALUE), JsonShape descriptor, JsonAccessRewriter, JsonSnapshotter for change tracking, and dialect-native DDL emission.

## 2.8.0

### Minor Changes

- [#133](https://github.com/mrabaev48/ts-linq/pull/133) [`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-43): implement database-first scaffolding (reverse engineer)

  Add `scaffoldDbContext()` to `@ts-linq/migrations` that reverse-engineers an existing database into TypeScript entity classes and a `DbContext`. Includes per-dialect introspectors (`PostgresDbIntrospector`, `MySqlDbIntrospector`, `MssqlDbIntrospector`) exported from dialect packages, a name normalizer with `--use-database-names` / `--no-pluralize` options, entity and DbContext code generators, and a new `scaffold` CLI command.

## 2.7.0

### Minor Changes

- [#131](https://github.com/mrabaev48/ts-linq/pull/131) [`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-33): implement stored procedure mapping for Insert/Update/Delete operations

  Adds `insertUsingStoredProcedure()`, `updateUsingStoredProcedure()`, and `deleteUsingStoredProcedure()`
  fluent API on `EntityTypeBuilder<T>`. When configured, `SaveChanges` routes entity CUD operations
  to dialect-specific CALL/EXEC statements instead of inline DML. Supports input/output parameters,
  original-value parameters, and rows-affected via result column, OUT parameter, or return value.
  Implemented for PostgreSQL (CALL), MySQL (CALL + follow-up SELECT), and MSSQL (EXEC).

## 2.6.0

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

## 2.5.0

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

## 2.4.0

### Minor Changes

- [#115](https://github.com/mrabaev48/ts-linq/pull/115) [`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(p0-10): implement concurrency tokens, RowVersion, and DbUpdateConcurrencyException
  - `PropertyBuilder.isConcurrencyToken()` and `isRowVersion()` fluent API methods
  - `ColumnMetadata.isConcurrencyToken` flag in `@ts-linq/types`
  - `DbUpdateConcurrencyException` with populated `entries: EntityEntry[]`
  - `EntityEntry.reload()` and `getDatabaseValues()` recovery helpers
  - WHERE-clause injection of original token values in UPDATE/DELETE for all three dialects (postgres, mysql, mssql)
  - `originalValues` propagated from ChangeTracker snapshot through the full save pipeline
  - `OptimisticConcurrencyError` re-thrown as `DbUpdateConcurrencyException` in `saveChanges()`

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

- [#125](https://github.com/mrabaev48/ts-linq/pull/125) [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-30): Add value generators and sentinel (EF8)

  Introduces pluggable client-side value generation and sentinel-based "not-set" detection, mirroring EF Core's `ValueGeneratedOnAdd` / `HasValueGenerator` / `HasSentinel` API.
  - **`@ts-linq/types`**: New `ValueGeneratedPolicy` enum (`Never`, `OnAdd`, `OnUpdate`, `OnAddOrUpdate`), `ValueGenerator<T>` interface, `ValueGeneratorClass<T>` type, `ValueGeneratorContext` interface. Extended `ColumnMetadata` with `valueGeneratedPolicy`, `sentinel`, and `valueGeneratorClass` fields.
  - **`@ts-linq/metadata`**: Re-exports all four new symbols from `@ts-linq/types`.
  - **`@ts-linq/orm`**: Six new `PropertyBuilder<T>` methods — `valueGeneratedOnAdd()`, `valueGeneratedOnUpdate()`, `valueGeneratedOnAddOrUpdate()`, `valueGeneratedNever()`, `hasValueGenerator(cls)`, `hasSentinel(value)`. Three built-in generators — `UlidValueGenerator`, `UuidV7ValueGenerator`, `UtcNowValueGenerator`. `DbContext.prefillDefaults()` extended to invoke client-side generators before INSERT/UPDATE using sentinel-aware comparison. `BatchGrouper.calcParamsPerRow()` updated to correctly exclude DB-side generated columns from INSERT parameter lists.

## 2.3.0

### Minor Changes

- 51516f8: feat(p0-04): add ExecuteUpdate and ExecuteDelete bulk DML (EF Core parity)

  `Queryable<T>` and `DbSet<T>` now expose `executeUpdate()` and `executeDelete()` — single-statement
  bulk DML that bypasses the change tracker, mirroring EF Core 7's `ExecuteUpdateAsync` / `ExecuteDeleteAsync`.
  - `@ts-linq/types`: `SetterSpec`, `BulkUpdateContext`, `BulkDeleteContext` interfaces;
    `buildBulkUpdate?` and `buildBulkDelete?` added to `SqlDialect`
  - `@ts-linq/query`: `ISetPropertyCalls<T>`, `SetPropertyCalls<T>`;
    `Queryable.executeUpdate()` and `Queryable.executeDelete()` terminal methods
  - `@ts-linq/orm`: `DbSet.executeUpdate()` and `DbSet.executeDelete()` delegation methods
  - `@ts-linq/dialect-postgres`: `buildBulkUpdate` / `buildBulkDelete` with `$N` placeholders
  - `@ts-linq/dialect-mssql`: `buildBulkUpdate` / `buildBulkDelete` with `@pN` placeholders
  - `@ts-linq/dialect-mysql`: `buildBulkUpdate` / `buildBulkDelete` with `?` placeholders
  - `@ts-linq/testkits`: `TestDialect.buildBulkUpdate` / `buildBulkDelete` for test assertions

  Supports literal values and column-reference copies. Throws a descriptive error when
  `include()` is chained before bulk DML (eager loading is not supported in this path).
  ChangeTracker staleness is documented — callers should reload affected entities if needed.

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
- 2f86a0d: feat(p0-10): implement concurrency tokens, RowVersion, and DbUpdateConcurrencyException
  - `PropertyBuilder.isConcurrencyToken()` and `isRowVersion()` fluent API methods
  - `ColumnMetadata.isConcurrencyToken` flag in `@ts-linq/types`
  - `DbUpdateConcurrencyException` with populated `entries: EntityEntry[]`
  - `EntityEntry.reload()` and `getDatabaseValues()` recovery helpers
  - WHERE-clause injection of original token values in UPDATE/DELETE for all three dialects (postgres, mysql, mssql)
  - `originalValues` propagated from ChangeTracker snapshot through the full save pipeline
  - `OptimisticConcurrencyError` re-thrown as `DbUpdateConcurrencyException` in `saveChanges()`

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

- d0668cb: feat(p2-46): add MaxBatchSize support for SaveChanges batching

  `DbContextOptionsBuilder.maxBatchSize(n)` enables multi-row INSERT/UPDATE/DELETE
  batching in `saveChanges()`, reducing N round-trips to ceil(N/batchSize) calls.
  - `@ts-linq/orm`: `DbContextOptionsBuilder.maxBatchSize()`, `BatchExecutor`, `BatchGrouper`
  - `@ts-linq/types`: `BatchInsertResult`, `BatchUpdateResult` interfaces; extended `SqlDialect`
  - `@ts-linq/sql-visitor`: `buildQuestionMarkRows`, `chunkArray`, `calcChunkSize` utilities
  - `@ts-linq/dialect-postgres`: `buildPgBatchInsert/Update/Delete`, `PostgresOptionsBuilder`
  - `@ts-linq/dialect-mssql`: `buildMssqlBatchInsert/Update/Delete`, `MssqlOptionsBuilder`
  - `@ts-linq/dialect-mysql`: `buildMysqlBatchInsert/Update/Delete`, `MysqlOptionsBuilder`

  PostgreSQL uses `INSERT ... RETURNING *` and CTE-based bulk UPDATE with type casts.
  MSSQL uses `INSERT ... OUTPUT INSERTED` and VALUES-JOIN bulk UPDATE.
  MySQL uses multi-row INSERT with `LAST_INSERT_ID()` for sequential PK assignment.
  MySQL UPDATE falls back to per-row statements (no clean multi-row UPDATE syntax).

### Patch Changes

- 6cad9cf: Add `logTo()` / `enableSensitiveDataLogging()` / `enableDetailedErrors()` / `configureWarnings()` diagnostic API (mirrors EF Core `LogTo` / `EnableSensitiveDataLogging` / `EnableDetailedErrors` / `ConfigureWarnings`).

  Key changes:
  - `DbContextOptionsBuilder.logTo(sink, level?)`: routes all diagnostic events to a user-supplied sink function. Level defaults to `'information'`.
  - `DbContextOptionsBuilder.enableSensitiveDataLogging()`: exposes raw SQL parameter values in messages. **Parameters are masked by default** (`:p0`, `:p1`, …) to prevent PII leakage.
  - `DbContextOptionsBuilder.enableDetailedErrors()`: appends full stack traces to error messages.
  - `DbContextOptionsBuilder.configureWarnings(w => w.throw(eventId).log(eventId).suppress(eventId))`: per-event routing — escalate to `EfWarningError`, force-log, or suppress entirely.
  - `DiagnosticEmitter` (new in `@ts-linq/telemetry`): single-chokepoint `SqlLogger` that applies masking, level filtering, and warning escalation. Automatically attached to the provider by `DbContext` when `logTo()` is configured.
  - `WarningConfigurationBuilder` (new in `@ts-linq/telemetry`): fluent builder for the warning route table.
  - `EfWarningError` (new in `@ts-linq/telemetry`): thrown when an event matches a `.throw(eventId)` route.
  - `CoreEventId` / `RelationalEventId` (new in `@ts-linq/telemetry`): string-constant event ID catalog mirroring EF Core's taxonomy.
  - `maskParams()` (new in `@ts-linq/telemetry`): utility that replaces param values with `:p0`, `:p1`, … positional placeholders.
  - `DatabaseProvider.attachLogger(extra)` (new in `@ts-linq/core`): public method to compose an additional `SqlLogger` alongside any existing one without replacing it.
  - `DbContextOptions.logging` (new in `@ts-linq/core`): optional field carrying the `DiagnosticConfig` produced by the builder.
  - `LogLevel`, `WarningBehavior`, `DiagnosticConfig` types added to `@ts-linq/types`.
  - Coexists with OTEL / custom loggers set at the provider level — both receive every event independently.

## 2.2.0

### Minor Changes

- [#98](https://github.com/mrabaev48/ts-linq/pull/98) [`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-35): add HierarchyId support — SQL Server hierarchyid with PostgreSQL ltree fallback

  Mirrors EF Core 8's `HierarchyId` API:
  - `HierarchyId` class in `@ts-linq/core` with `getLevel`, `getAncestor`, `isDescendantOf`, `getDescendant`, `toString`, `toLtreeString`
  - `HierarchyIdTranslator` interface in `@ts-linq/types`
  - `HierarchyMethod` union type (`isDescendantOf | getLevel | getAncestor`) in `@ts-linq/ast`
  - `HierarchyMethodVisitor` in `@ts-linq/sql-visitor` — dispatches to dialect-specific SQL
  - `mssqlHierarchyFunctions` in `@ts-linq/dialect-mssql` — uses `hierarchyid::Parse(?)`, `.GetLevel()`, `.GetAncestor(?)`
  - `postgresLtreeFunctions` in `@ts-linq/dialect-postgres` — uses `<@`, `nlevel()`, `subpath()`
  - MSSQL codec (`encodeHierarchyId` / `decodeHierarchyId`) in `@ts-linq/provider-mssql`
  - Postgres ltree codec (`encodeLtree` / `decodeLtree`) in `@ts-linq/provider-postgres`
  - Both providers detect `HierarchyId` in `coerceToSqlParameter` before geometry/JSON fallback

## 2.1.0

### Minor Changes

- [#97](https://github.com/mrabaev48/ts-linq/pull/97) [`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Add spatial / geospatial types support (P2-34)

  Implements a NetTopologySuite-equivalent spatial type system:
  - **`@ts-linq/core`** — `Geometry`, `Point`, `LineString`, `Polygon`, `MultiPoint`, `MultiLineString`, `MultiPolygon`, `GeometryCollection` interfaces with factory functions and type guards
  - **`@ts-linq/ast`** — `SpatialMethod` union type; `MethodNode.method` extended to include spatial method names
  - **`@ts-linq/types`** — `SpatialTranslator` interface for dialect-specific spatial SQL generation
  - **`@ts-linq/sql-visitor`** — `SpatialMethodVisitor`, `isSpatialMethod` helper; `SqlVisitor` accepts `{ spatialTranslator }` option
  - **`@ts-linq/dialect-postgres`** — `postgisSpatialFunctions` (PostGIS `ST_*` functions)
  - **`@ts-linq/dialect-mysql`** — `mysqlSpatialFunctions` (MySQL `ST_*` + `ST_Distance_Sphere`)
  - **`@ts-linq/dialect-mssql`** — `mssqlSpatialFunctions` (method-syntax `.STDistance()` etc.)
  - **`@ts-linq/provider-postgres`** — EWKB encode/decode codec; `Geometry` auto-coercion in `coerceToSqlParameter`
  - **`@ts-linq/provider-mysql`** — ISO WKB encode/decode codec; `Geometry` auto-coercion
  - **`@ts-linq/provider-mssql`** — WKT encode/decode codec; `Geometry` auto-coercion
  - **`@ts-linq/orm`** — `DbContextOptionsBuilder.useSpatial()` method

## 2.0.0

### Minor Changes

- [#93](https://github.com/mrabaev48/ts-linq/pull/93) [`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-23): add transaction savepoints and ExecutionStrategy (EnableRetryOnFailure)

  Introduces first-class savepoint API and retry-on-failure execution strategy mirroring EF Core.

  **New public APIs:**
  - `context.database.beginTransactionAsync()` → `DbContextTransaction` with savepoint methods (`createSavepointAsync`, `rollbackToSavepointAsync`, `releaseSavepointAsync`, `commitAsync`, `rollbackAsync`) and `AsyncDisposable` support for `await using`
  - `context.database.createExecutionStrategy()` → `ExecutionStrategy` with `executeAsync(fn)` for automatic transient-error retry with exponential backoff
  - `DbContextOptionsBuilder.enableRetryOnFailure(options)` to configure retry behaviour
  - `ExecutionStrategy` class exported from `@ts-linq/concurrency`
  - `ExecutionStrategyOptions` interface in `@ts-linq/types`

  **Provider enhancements:**
  - `DatabaseProvider.createSavepoint/rollbackToSavepoint/releaseSavepoint` (ANSI SQL default; MSSQL uses `SAVE TRANSACTION` syntax)
  - `DatabaseProvider.checkTransientError()` public facade over transient error classifier
  - Dialect-specific transient error code lists for PostgreSQL (40P01, 40001…), MySQL (1213, 2013…), and SQL Server (1205, 1222…)

  **Breaking changes:** none — all additions are backward compatible.
