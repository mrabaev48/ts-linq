# @ts-linq/dialect-mssql

## 2.6.15

### Patch Changes

- Updated dependencies [[`75a9436`](https://github.com/mrabaev48/ts-linq/commit/75a94365e4112b46e74bfaa6fce6dd3c8e86fbb3)]:
  - @ts-linq/sql-visitor@2.9.0
  - @ts-linq/core@3.0.2

## 2.6.14

### Patch Changes

- [#171](https://github.com/mrabaev48/ts-linq/pull/171) [`7986b75`](https://github.com/mrabaev48/ts-linq/commit/7986b75e27fbb720238c3d160c47fa79de3f340e) Thanks [@mrabaev48](https://github.com/mrabaev48)! - De-duplicate the `jsonPath` AST node: restore a single source of truth.

  **What changed**
  - **`@ts-linq/ast`** — `Nodes.ts` no longer redeclares the `jsonPath` node inline. The
    `ExpressionNode` union now references the canonical `JsonPathExpression` directly, and the
    misleading "re-export … imported inline" comment was removed. `JsonPathNode` is retained as a
    `@deprecated` type alias (`export type JsonPathNode = JsonPathExpression`) so existing imports
    keep compiling. No runtime/shape change.
  - **`@ts-linq/sql-visitor`** — now re-exports the canonical `JsonPathExpression` (additive);
    the internal `JsonAccessRewriter` and `JsonPathVisitor`/`JsonPathTranslator` were migrated to
    it. The `JsonPathNode` re-export is kept as `@deprecated` for backward compatibility.
  - **`@ts-linq/dialect-{postgres,mysql,mssql}`** — JSON-path translators now reference
    `JsonPathExpression` instead of the deprecated `JsonPathNode` alias. Internal type rename only;
    no behavioral change.

  **Migration**

  No action required — `JsonPathNode` still resolves via a deprecated alias. New code should import
  `JsonPathExpression` from `@ts-linq/ast` (or `@ts-linq/sql-visitor`). The `JsonPathNode` alias is
  slated for removal in a future major release.

- Updated dependencies [[`7986b75`](https://github.com/mrabaev48/ts-linq/commit/7986b75e27fbb720238c3d160c47fa79de3f340e)]:
  - @ts-linq/sql-visitor@2.8.0
  - @ts-linq/core@3.0.1

## 2.6.13

### Patch Changes

- Updated dependencies [[`6c1d403`](https://github.com/mrabaev48/ts-linq/commit/6c1d403078729a825c39af05bf4dc6ea8c9df644)]:
  - @ts-linq/types@4.0.0
  - @ts-linq/metadata@4.0.0
  - @ts-linq/core@3.0.0
  - @ts-linq/sql-visitor@2.7.7

## 2.6.12

### Patch Changes

- Updated dependencies [[`ccd7235`](https://github.com/mrabaev48/ts-linq/commit/ccd72359ce15f46cca059afba1a2c39d5ea823f2)]:
  - @ts-linq/metadata@3.1.2
  - @ts-linq/core@2.0.6

## 2.6.11

### Patch Changes

- Updated dependencies [[`32cda43`](https://github.com/mrabaev48/ts-linq/commit/32cda43913c6a701add02b0171c4a399147b3d26)]:
  - @ts-linq/metadata@3.1.1
  - @ts-linq/core@2.0.5

## 2.6.10

### Patch Changes

- Updated dependencies [[`40a71ed`](https://github.com/mrabaev48/ts-linq/commit/40a71ed3079bdf86492e9f27a226470a3985f39e)]:
  - @ts-linq/types@3.1.0
  - @ts-linq/metadata@3.1.0
  - @ts-linq/core@2.0.4
  - @ts-linq/sql-visitor@2.7.6

## 2.6.9

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@2.0.3

## 2.6.8

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@2.0.2

## 2.6.7

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@2.0.1

## 2.6.6

### Patch Changes

- Updated dependencies [[`5995782`](https://github.com/mrabaev48/ts-linq/commit/5995782a9f1c7449d7ad457a8cf1700cd80b9c0d)]:
  - @ts-linq/types@3.0.0
  - @ts-linq/core@2.0.0
  - @ts-linq/metadata@3.0.0
  - @ts-linq/sql-visitor@2.7.5

## 2.6.5

### Patch Changes

- Updated dependencies [[`fcc484a`](https://github.com/mrabaev48/ts-linq/commit/fcc484a7e9c13f53c30a9e9beac62baf7c616f85)]:
  - @ts-linq/types@2.12.1
  - @ts-linq/core@1.5.3
  - @ts-linq/metadata@2.7.3
  - @ts-linq/sql-visitor@2.7.4

## 2.6.4

### Patch Changes

- Updated dependencies [[`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f)]:
  - @ts-linq/types@2.12.0
  - @ts-linq/core@1.5.2
  - @ts-linq/sql-visitor@2.7.3
  - @ts-linq/metadata@2.7.2

## 2.6.3

### Patch Changes

- Updated dependencies [[`2df83e5`](https://github.com/mrabaev48/ts-linq/commit/2df83e5c5c49a1c4be98748905fdf2d9511b4d56)]:
  - @ts-linq/types@2.11.1
  - @ts-linq/core@1.5.1
  - @ts-linq/metadata@2.7.1
  - @ts-linq/sql-visitor@2.7.2

## 2.6.2

### Patch Changes

- Updated dependencies [[`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6)]:
  - @ts-linq/types@2.11.0
  - @ts-linq/metadata@2.7.0
  - @ts-linq/core@1.5.0
  - @ts-linq/sql-visitor@2.7.1

## 2.6.1

### Patch Changes

- Updated dependencies [[`f03dbf1`](https://github.com/mrabaev48/ts-linq/commit/f03dbf1d4c9ee5f10faf70a3d87babc638918508)]:
  - @ts-linq/types@2.10.0
  - @ts-linq/sql-visitor@2.7.0
  - @ts-linq/core@1.4.8
  - @ts-linq/metadata@2.6.2

## 2.6.0

### Minor Changes

- [#137](https://github.com/mrabaev48/ts-linq/pull/137) [`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-15): implement JSON columns — OwnsOne/OwnsMany with ToJson(), LINQ querying into JSON paths, per-dialect SQL translation (Postgres JSONB, MySQL JSON, MSSQL JSON_VALUE), JsonShape descriptor, JsonAccessRewriter, JsonSnapshotter for change tracking, and dialect-native DDL emission.

### Patch Changes

- Updated dependencies [[`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252)]:
  - @ts-linq/sql-visitor@2.6.0
  - @ts-linq/core@1.4.7
  - @ts-linq/types@2.9.0
  - @ts-linq/metadata@2.6.1

## 2.5.1

### Patch Changes

- Updated dependencies [[`a3c75aa`](https://github.com/mrabaev48/ts-linq/commit/a3c75aab0b5c3304f0e4bf3c6471f74ee9e4f580)]:
  - @ts-linq/metadata@2.6.0
  - @ts-linq/core@1.4.6

## 2.5.0

### Minor Changes

- [#133](https://github.com/mrabaev48/ts-linq/pull/133) [`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-43): implement database-first scaffolding (reverse engineer)

  Add `scaffoldDbContext()` to `@ts-linq/migrations` that reverse-engineers an existing database into TypeScript entity classes and a `DbContext`. Includes per-dialect introspectors (`PostgresDbIntrospector`, `MySqlDbIntrospector`, `MssqlDbIntrospector`) exported from dialect packages, a name normalizer with `--use-database-names` / `--no-pluralize` options, entity and DbContext code generators, and a new `scaffold` CLI command.

### Patch Changes

- Updated dependencies [[`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0)]:
  - @ts-linq/types@2.8.0
  - @ts-linq/core@1.4.5
  - @ts-linq/metadata@2.5.1
  - @ts-linq/sql-visitor@2.5.1

## 2.4.3

### Patch Changes

- [#131](https://github.com/mrabaev48/ts-linq/pull/131) [`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-33): implement stored procedure mapping for Insert/Update/Delete operations

  Adds `insertUsingStoredProcedure()`, `updateUsingStoredProcedure()`, and `deleteUsingStoredProcedure()`
  fluent API on `EntityTypeBuilder<T>`. When configured, `SaveChanges` routes entity CUD operations
  to dialect-specific CALL/EXEC statements instead of inline DML. Supports input/output parameters,
  original-value parameters, and rows-affected via result column, OUT parameter, or return value.
  Implemented for PostgreSQL (CALL), MySQL (CALL + follow-up SELECT), and MSSQL (EXEC).

- Updated dependencies [[`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54)]:
  - @ts-linq/metadata@2.5.0
  - @ts-linq/sql-visitor@2.5.0
  - @ts-linq/types@2.7.0
  - @ts-linq/core@1.4.4

## 2.4.2

### Patch Changes

- Updated dependencies [[`1a0d098`](https://github.com/mrabaev48/ts-linq/commit/1a0d098baa3e18f406eafae8281ee7daf442cdea)]:
  - @ts-linq/types@2.6.0
  - @ts-linq/metadata@2.4.0
  - @ts-linq/core@1.4.3
  - @ts-linq/sql-visitor@2.4.2

## 2.4.1

### Patch Changes

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

- Updated dependencies [[`4c6abea`](https://github.com/mrabaev48/ts-linq/commit/4c6abead6c23c96d3faa01c4f12368f92ed935f5)]:
  - @ts-linq/types@2.5.0
  - @ts-linq/metadata@2.3.0
  - @ts-linq/core@1.4.2
  - @ts-linq/sql-visitor@2.4.1

## 2.4.0

### Minor Changes

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

- [#115](https://github.com/mrabaev48/ts-linq/pull/115) [`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(p0-10): implement concurrency tokens, RowVersion, and DbUpdateConcurrencyException
  - `PropertyBuilder.isConcurrencyToken()` and `isRowVersion()` fluent API methods
  - `ColumnMetadata.isConcurrencyToken` flag in `@ts-linq/types`
  - `DbUpdateConcurrencyException` with populated `entries: EntityEntry[]`
  - `EntityEntry.reload()` and `getDatabaseValues()` recovery helpers
  - WHERE-clause injection of original token values in UPDATE/DELETE for all three dialects (postgres, mysql, mssql)
  - `originalValues` propagated from ChangeTracker snapshot through the full save pipeline
  - `OptimisticConcurrencyError` re-thrown as `DbUpdateConcurrencyException` in `saveChanges()`

- [#123](https://github.com/mrabaev48/ts-linq/pull/123) [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Add `toView()`, `hasNoKey()`, and `hasViewSql()` for mapping entities to database views as keyless (read-only) types. Keyless entities are never tracked, throw `KeylessMutationError` on mutations, and query via `FROM viewName` in all dialects.

- Updated dependencies [[`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7), [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8), [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3), [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b), [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795), [`568ec79`](https://github.com/mrabaev48/ts-linq/commit/568ec792462bc5f1f9686d7a903bbe01592f71bb), [`cda8a4e`](https://github.com/mrabaev48/ts-linq/commit/cda8a4edac105bffd343fe8637f0340c361486e2), [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4), [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907)]:
  - @ts-linq/types@2.4.0
  - @ts-linq/core@1.4.1
  - @ts-linq/metadata@2.2.0
  - @ts-linq/sql-visitor@2.4.0

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

- 2f86a0d: feat(p0-10): implement concurrency tokens, RowVersion, and DbUpdateConcurrencyException
  - `PropertyBuilder.isConcurrencyToken()` and `isRowVersion()` fluent API methods
  - `ColumnMetadata.isConcurrencyToken` flag in `@ts-linq/types`
  - `DbUpdateConcurrencyException` with populated `entries: EntityEntry[]`
  - `EntityEntry.reload()` and `getDatabaseValues()` recovery helpers
  - WHERE-clause injection of original token values in UPDATE/DELETE for all three dialects (postgres, mysql, mssql)
  - `originalValues` propagated from ChangeTracker snapshot through the full save pipeline
  - `OptimisticConcurrencyError` re-thrown as `DbUpdateConcurrencyException` in `saveChanges()`

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

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/core@1.3.0
  - @ts-linq/types@2.2.0
  - @ts-linq/metadata@2.0.2

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

### Patch Changes

- Updated dependencies [[`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb), [`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/core@1.2.0
  - @ts-linq/types@2.1.0
  - @ts-linq/metadata@2.0.1

## 2.0.0

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/core@1.1.0
  - @ts-linq/types@2.0.0
  - @ts-linq/metadata@2.0.0
