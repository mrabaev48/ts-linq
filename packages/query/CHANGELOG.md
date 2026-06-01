# @ts-linq/query

## 2.3.1

### Patch Changes

- Updated dependencies [[`4c6abea`](https://github.com/mrabaev48/ts-linq/commit/4c6abead6c23c96d3faa01c4f12368f92ed935f5)]:
  - @ts-linq/types@2.5.0
  - @ts-linq/metadata@2.3.0
  - @ts-linq/ast@2.3.1
  - @ts-linq/core@1.4.2
  - @ts-linq/sql-visitor@2.4.1

## 2.3.0

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

- [#121](https://github.com/mrabaev48/ts-linq/pull/121) [`568ec79`](https://github.com/mrabaev48/ts-linq/commit/568ec792462bc5f1f9686d7a903bbe01592f71bb) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-22): implement EF.functions and HasDbFunction

  Adds `EF.functions` marker object with `like`, `iLike`, `random`, `dateDiffDay`,
  `dateDiffMonth`, `greatest`, `least`, `stDev`, `variance` — all as compile-time
  markers that throw at runtime outside LINQ expressions.

  Adds a new `EfFunctionNode` AST node, transformer CallVisitor recognition of
  `EF.functions.xxx(...)` patterns, per-dialect `EfFunctionTranslator` implementations
  for PostgreSQL (`postgresEfFunctions`), MySQL (`mysqlEfFunctions`), and MSSQL
  (`mssqlEfFunctions`), and `EfFunctionVisitor` in `@ts-linq/sql-visitor`.

  Adds `ModelBuilder.hasDbFunction()` with `DbFunctionBuilder.hasName()` for
  registering user-defined SQL functions for use in LINQ expressions.

### Patch Changes

- [#123](https://github.com/mrabaev48/ts-linq/pull/123) [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Add `toView()`, `hasNoKey()`, and `hasViewSql()` for mapping entities to database views as keyless (read-only) types. Keyless entities are never tracked, throw `KeylessMutationError` on mutations, and query via `FROM viewName` in all dialects.

- Updated dependencies [[`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7), [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8), [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3), [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b), [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795), [`568ec79`](https://github.com/mrabaev48/ts-linq/commit/568ec792462bc5f1f9686d7a903bbe01592f71bb), [`cda8a4e`](https://github.com/mrabaev48/ts-linq/commit/cda8a4edac105bffd343fe8637f0340c361486e2), [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4), [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907)]:
  - @ts-linq/types@2.4.0
  - @ts-linq/core@1.4.1
  - @ts-linq/metadata@2.2.0
  - @ts-linq/ast@2.3.0
  - @ts-linq/sql-visitor@2.4.0

## 2.2.0

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

- 90402db: feat(p0-07): add inheritance mapping — TPH, TPT, TPC
  - New `InheritanceStrategy` enum, `HierarchyMetadata`, `DiscriminatorMetadata` types in `@ts-linq/types`
  - `EntityMetadata` extended with `hierarchy?` (root) and `hierarchyRoot?` (subtype) fields
  - `MetadataRegistry`/`MetadataStorage` gain `setHierarchyMetadata()` and `setHierarchyRoot()` methods
  - New `DiscriminatorBuilder<TKey>` fluent builder with `hasValue()` and `isComplete()` — mirrors EF Core API
  - `EntityTypeBuilder` gains `hasDiscriminator()`, `useTphMappingStrategy()`, `useTptMappingStrategy()`, `useTpcMappingStrategy()`
  - `Queryable.ofType<TSub>(ctor)` filters the query: TPH adds WHERE on discriminator, TPT adds INNER JOIN, TPC changes FROM table
  - `RowMaterializer` performs polymorphic dispatch — reads discriminator value from DB row and instantiates the correct concrete subtype
  - `ModelSnapshotBuilder` emits DDL-correct snapshots: TPH adds discriminator column, TPT registers subtype tables, TPC builds full leaf tables with inherited columns

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

- 84a1e2d: Add `tagWith()` / `tagWithCallSite()` query tagging API (mirrors EF Core 8 `TagWith` / `TagWithCallSite`).

  Tags are emitted as leading `-- comment` SQL lines before the statement, making queries identifiable
  in DBA tools, query stores, and slow-query logs without ambiguity.

  Key changes:
  - `Queryable.tagWith(tag)`: attach a diagnostic string comment to the emitted SQL. Multiple calls accumulate in order.
  - `Queryable.tagWithCallSite()`: auto-capture caller's source file and line via `Error().stack` and append as a tag.
  - `Queryable.getTags()`: inspect the current tag list without executing.
  - `DbSet.tagWith()` / `DbSet.tagWithCallSite()` / `DbSet.getTags()`: delegation methods on `DbSet<T>`.
  - `QueryTagError`: thrown at call time when a tag contains newlines or comment-break sequences (`*/`).
  - `QueryTagList` type and `sanitizeTag()` exported from `@ts-linq/query`.
  - `emitTagComments(tags)` exported from `@ts-linq/sql-visitor`: converts a tag list to a SQL comment block.
  - `parseTagsFromSql(sql)` exported from `@ts-linq/telemetry`: extracts leading `-- ` comment lines from SQL.
  - `TelemetryProvider.queryStart()` now adds `db.query.tags` as a structured OTEL span attribute when tags are present.
  - Tags are NOT part of the SQL cache key — the clean SQL is cached, tags are prepended at execution time.

### Patch Changes

- Updated dependencies [51516f8]
- Updated dependencies [cd77e1f]
- Updated dependencies [7745012]
- Updated dependencies [90402db]
- Updated dependencies [240059c]
- Updated dependencies [2f86a0d]
- Updated dependencies [b738384]
- Updated dependencies [84a1e2d]
- Updated dependencies [6cad9cf]
- Updated dependencies [d0668cb]
  - @ts-linq/types@2.3.0
  - @ts-linq/metadata@2.1.0
  - @ts-linq/sql-visitor@2.3.0
  - @ts-linq/core@1.4.0
  - @ts-linq/ast@2.2.1

## 2.1.1

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/ast@2.2.0
  - @ts-linq/core@1.3.0
  - @ts-linq/sql-visitor@2.2.0
  - @ts-linq/types@2.2.0
  - @ts-linq/metadata@2.0.2

## 2.1.0

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

### Patch Changes

- Updated dependencies [[`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb), [`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/core@1.2.0
  - @ts-linq/ast@2.1.0
  - @ts-linq/types@2.1.0
  - @ts-linq/sql-visitor@2.1.0
  - @ts-linq/metadata@2.0.1

## 2.0.0

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/core@1.1.0
  - @ts-linq/types@2.0.0
  - @ts-linq/ast@2.0.0
  - @ts-linq/metadata@2.0.0
  - @ts-linq/sql-visitor@2.0.0
