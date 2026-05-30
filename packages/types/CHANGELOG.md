# @ts-linq/types

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
