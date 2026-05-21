# @ts-linq/provider-mssql

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

- Updated dependencies [[`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb), [`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/core@1.2.0
  - @ts-linq/types@2.1.0
  - @ts-linq/dialect-mssql@2.1.0
  - @ts-linq/metadata@2.0.1

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

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/core@1.1.0
  - @ts-linq/types@2.0.0
  - @ts-linq/dialect-mssql@2.0.0
  - @ts-linq/metadata@2.0.0
