---
"@ts-linq/types": minor
"@ts-linq/query": minor
"@ts-linq/orm": minor
"@ts-linq/metadata": minor
"@ts-linq/dialect-mssql": minor
"@ts-linq/dialect-postgres": patch
"@ts-linq/dialect-mysql": patch
---

feat(temporal): add SQL Server system-versioned table query operators (P2-36)

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
