# @ts-linq/core

## 3.0.2

### Patch Changes

- Updated dependencies [[`75a9436`](https://github.com/mrabaev48/ts-linq/commit/75a94365e4112b46e74bfaa6fce6dd3c8e86fbb3)]:
  - @ts-linq/ast@3.0.0

## 3.0.1

### Patch Changes

- Updated dependencies [[`7986b75`](https://github.com/mrabaev48/ts-linq/commit/7986b75e27fbb720238c3d160c47fa79de3f340e)]:
  - @ts-linq/ast@2.5.0

## 3.0.0

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
  - @ts-linq/metadata@4.0.0
  - @ts-linq/ast@2.4.8
  - @ts-linq/metrics-safe@1.2.2

## 2.0.6

### Patch Changes

- Updated dependencies [[`ccd7235`](https://github.com/mrabaev48/ts-linq/commit/ccd72359ce15f46cca059afba1a2c39d5ea823f2)]:
  - @ts-linq/metadata@3.1.2

## 2.0.5

### Patch Changes

- Updated dependencies [[`32cda43`](https://github.com/mrabaev48/ts-linq/commit/32cda43913c6a701add02b0171c4a399147b3d26)]:
  - @ts-linq/metadata@3.1.1

## 2.0.4

### Patch Changes

- Updated dependencies [[`40a71ed`](https://github.com/mrabaev48/ts-linq/commit/40a71ed3079bdf86492e9f27a226470a3985f39e)]:
  - @ts-linq/types@3.1.0
  - @ts-linq/metadata@3.1.0
  - @ts-linq/ast@2.4.7
  - @ts-linq/metrics-safe@1.2.1

## 2.0.3

### Patch Changes

- Updated dependencies [[`941ad27`](https://github.com/mrabaev48/ts-linq/commit/941ad273c224d8968a7c49c385052c0504284e17)]:
  - @ts-linq/metrics-safe@1.2.0

## 2.0.2

### Patch Changes

- Updated dependencies [[`70a5949`](https://github.com/mrabaev48/ts-linq/commit/70a5949c4d9640aab4855506e4c0540cf6344cd6)]:
  - @ts-linq/metrics-safe@1.1.0

## 2.0.1

### Patch Changes

- Updated dependencies [[`8e79681`](https://github.com/mrabaev48/ts-linq/commit/8e79681455dca1c1f60a616cb9b8882ca9cafef6)]:
  - @ts-linq/metrics-safe@1.0.1

## 2.0.0

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
  - @ts-linq/metadata@3.0.0
  - @ts-linq/ast@2.4.6

## 1.5.3

### Patch Changes

- Updated dependencies [[`fcc484a`](https://github.com/mrabaev48/ts-linq/commit/fcc484a7e9c13f53c30a9e9beac62baf7c616f85)]:
  - @ts-linq/types@2.12.1
  - @ts-linq/ast@2.4.5
  - @ts-linq/metadata@2.7.3

## 1.5.2

### Patch Changes

- Updated dependencies [[`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f), [`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f)]:
  - @ts-linq/ast@2.4.4
  - @ts-linq/types@2.12.0
  - @ts-linq/metadata@2.7.2

## 1.5.1

### Patch Changes

- Updated dependencies [[`2df83e5`](https://github.com/mrabaev48/ts-linq/commit/2df83e5c5c49a1c4be98748905fdf2d9511b4d56)]:
  - @ts-linq/types@2.11.1
  - @ts-linq/ast@2.4.3
  - @ts-linq/metadata@2.7.1

## 1.5.0

### Minor Changes

- [#141](https://github.com/mrabaev48/ts-linq/pull/141) [`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-21): implement Sequences and HiLo — ModelBuilder.hasSequence(), PropertyBuilder.useHiLo()/useSequence(), HiLoValueGenerator with per-context block reservation, native CREATE SEQUENCE DDL for PostgreSQL/MSSQL, counter-table emulation for MySQL, full schema diff and migration support

### Patch Changes

- Updated dependencies [[`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6)]:
  - @ts-linq/types@2.11.0
  - @ts-linq/metadata@2.7.0
  - @ts-linq/ast@2.4.2

## 1.4.8

### Patch Changes

- Updated dependencies [[`f03dbf1`](https://github.com/mrabaev48/ts-linq/commit/f03dbf1d4c9ee5f10faf70a3d87babc638918508)]:
  - @ts-linq/types@2.10.0
  - @ts-linq/ast@2.4.1
  - @ts-linq/metadata@2.6.2

## 1.4.7

### Patch Changes

- [#137](https://github.com/mrabaev48/ts-linq/pull/137) [`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-15): implement JSON columns — OwnsOne/OwnsMany with ToJson(), LINQ querying into JSON paths, per-dialect SQL translation (Postgres JSONB, MySQL JSON, MSSQL JSON_VALUE), JsonShape descriptor, JsonAccessRewriter, JsonSnapshotter for change tracking, and dialect-native DDL emission.

- Updated dependencies [[`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252)]:
  - @ts-linq/ast@2.4.0
  - @ts-linq/types@2.9.0
  - @ts-linq/metadata@2.6.1

## 1.4.6

### Patch Changes

- Updated dependencies [[`a3c75aa`](https://github.com/mrabaev48/ts-linq/commit/a3c75aab0b5c3304f0e4bf3c6471f74ee9e4f580)]:
  - @ts-linq/metadata@2.6.0

## 1.4.5

### Patch Changes

- Updated dependencies [[`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0)]:
  - @ts-linq/types@2.8.0
  - @ts-linq/ast@2.3.4
  - @ts-linq/metadata@2.5.1

## 1.4.4

### Patch Changes

- Updated dependencies [[`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54)]:
  - @ts-linq/metadata@2.5.0
  - @ts-linq/types@2.7.0
  - @ts-linq/ast@2.3.3

## 1.4.3

### Patch Changes

- Updated dependencies [[`1a0d098`](https://github.com/mrabaev48/ts-linq/commit/1a0d098baa3e18f406eafae8281ee7daf442cdea)]:
  - @ts-linq/types@2.6.0
  - @ts-linq/metadata@2.4.0
  - @ts-linq/ast@2.3.2

## 1.4.2

### Patch Changes

- Updated dependencies [[`4c6abea`](https://github.com/mrabaev48/ts-linq/commit/4c6abead6c23c96d3faa01c4f12368f92ed935f5)]:
  - @ts-linq/types@2.5.0
  - @ts-linq/metadata@2.3.0
  - @ts-linq/ast@2.3.1

## 1.4.1

### Patch Changes

- [#115](https://github.com/mrabaev48/ts-linq/pull/115) [`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(p0-10): implement concurrency tokens, RowVersion, and DbUpdateConcurrencyException
  - `PropertyBuilder.isConcurrencyToken()` and `isRowVersion()` fluent API methods
  - `ColumnMetadata.isConcurrencyToken` flag in `@ts-linq/types`
  - `DbUpdateConcurrencyException` with populated `entries: EntityEntry[]`
  - `EntityEntry.reload()` and `getDatabaseValues()` recovery helpers
  - WHERE-clause injection of original token values in UPDATE/DELETE for all three dialects (postgres, mysql, mssql)
  - `originalValues` propagated from ChangeTracker snapshot through the full save pipeline
  - `OptimisticConcurrencyError` re-thrown as `DbUpdateConcurrencyException` in `saveChanges()`

- Updated dependencies [[`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7), [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8), [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3), [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b), [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795), [`568ec79`](https://github.com/mrabaev48/ts-linq/commit/568ec792462bc5f1f9686d7a903bbe01592f71bb), [`cda8a4e`](https://github.com/mrabaev48/ts-linq/commit/cda8a4edac105bffd343fe8637f0340c361486e2), [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4), [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907)]:
  - @ts-linq/types@2.4.0
  - @ts-linq/metadata@2.2.0
  - @ts-linq/ast@2.3.0

## 1.4.0

### Minor Changes

- 7745012: feat(p0-06): add OwnedEntityTypes — OwnsOne, OwnsMany, ToJson, table-splitting
  - `StorageStrategy` enum (TableSplit | SeparateTable | Json) in `@ts-linq/types`
  - `OwnedEntityMetadata` interface + `EntityMetadata.ownedEntities` field
  - `MetadataRegistry.addOwnedEntity()` / `getOwnedEntities()` in `@ts-linq/metadata`
  - New `OwnedNavigationBuilder<TOwner, TOwned>` in `@ts-linq/orm` with `property()`, `withOwner()`, `hasForeignKey()`, `hasKey()`, `toTable()`, `toJson()`
  - `EntityTypeBuilder.ownsOne()` / `ownsMany()` on existing builder
  - `ModelSnapshotBuilder` expands owned columns (TableSplit prefixed columns, Json column, SeparateTable extra table)
  - `hydrateTableSplit` / `hydrateJson` / `hydrateOwnedEntities` materialization utilities in `@ts-linq/core`

### Patch Changes

- 2f86a0d: feat(p0-10): implement concurrency tokens, RowVersion, and DbUpdateConcurrencyException
  - `PropertyBuilder.isConcurrencyToken()` and `isRowVersion()` fluent API methods
  - `ColumnMetadata.isConcurrencyToken` flag in `@ts-linq/types`
  - `DbUpdateConcurrencyException` with populated `entries: EntityEntry[]`
  - `EntityEntry.reload()` and `getDatabaseValues()` recovery helpers
  - WHERE-clause injection of original token values in UPDATE/DELETE for all three dialects (postgres, mysql, mssql)
  - `originalValues` propagated from ChangeTracker snapshot through the full save pipeline
  - `OptimisticConcurrencyError` re-thrown as `DbUpdateConcurrencyException` in `saveChanges()`

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
  - @ts-linq/metadata@2.1.0
  - @ts-linq/ast@2.2.1

## 1.3.0

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

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/ast@2.2.0
  - @ts-linq/types@2.2.0
  - @ts-linq/metadata@2.0.2

## 1.2.0

### Minor Changes

- [#95](https://github.com/mrabaev48/ts-linq/pull/95) [`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-27): add asAsyncEnumerable / forEachAsync / toDictionaryAsync streaming operators

  Enables memory-bounded processing of large result sets via chunked OFFSET pagination (1000 rows per chunk by default). Mirrors EF Core's streaming API.

  **New public APIs on `Queryable<T>` and `DbSet<T>`:**
  - `asAsyncEnumerable(signal?: AbortSignal): AsyncIterable<T>` — streams entities via `for await`, respects `.take()` and `.skip()` on the chain
  - `forEachAsync(action, signal?): Promise<void>` — async forEach over streamed entities
  - `toDictionaryAsync<K>(keySelector, signal?): Promise<Map<K, T>>` — keyed map, throws on duplicate keys
  - `toDictionaryAsync<K, V>(keySelector, elementSelector, signal?): Promise<Map<K, V>>` — projected keyed map

  **New `DatabaseProvider` streaming primitives:**
  - `streamRows(baseSql, params, startOffset, maxRows?, signal?): AsyncIterable<Row>` — chunked pagination primitive
  - `buildChunkSql(baseSql, chunkLimit, offset): string` — protected, overridable per dialect

  **Provider changes:**
  - `MssqlProvider.buildChunkSql`: uses `OFFSET n ROWS FETCH NEXT m ROWS ONLY` with automatic `ORDER BY (SELECT NULL)` injection when ORDER BY is absent

  **AbortSignal support:** cancellation is checked between chunks (granularity: 1000 rows by default).

  **EF Core error parity:** `toDictionaryAsync` throws `"An item with the same key has already been added. Key: <key>"` on duplicate keys.

  **Limitations (documented):**
  - `include()`/`thenInclude()` are not populated during streaming; use `toListAsync()` when eager loading is required.
  - `NoTrackingWithIdentityResolution` falls back to no-tracking in streaming path.

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

### Patch Changes

- Updated dependencies [[`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/ast@2.1.0
  - @ts-linq/types@2.1.0
  - @ts-linq/metadata@2.0.1

## 1.1.0

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

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/types@2.0.0
  - @ts-linq/ast@2.0.0
  - @ts-linq/metadata@2.0.0
