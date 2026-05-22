# P2-36 — Temporal Queries (SQL Server System-Versioned Tables)

**Status:** done (branch feat/p2-36-temporal-queries)

## Architecture

### New types (`@ts-linq/types`)

- `TemporalMode = 'AsOf' | 'All' | 'Between' | 'FromTo' | 'ContainedIn'`
- `TemporalClause { mode: TemporalMode; from?: Date; to?: Date }`
- `QueryOptions.temporal?: TemporalClause` (new optional field)
- `EntityMetadata.isTemporal?: boolean` (new optional field)
- `EntityMetadata.historyTableName?: string` (new optional field)
- `TemporalNotSupportedError extends Error` — exported from `errors.ts`

### QueryModel (`@ts-linq/query`)

- `packages/query/src/QueryModel.ts` — added `temporal?: TemporalClause` field
- `clone()` copies `temporal` (shallow — it's readonly)
- `packages/query/src/QueryBuilder.ts` `generateFromModel()` — fixed bug: now passes `from` and `temporal` to `QueryOptions` (was missing both)

### Queryable temporal methods (`@ts-linq/query`)

`packages/query/src/Queryable.ts` — 5 new methods (section `// ─── Temporal API`):
- `temporalAsOf(pointInTime: Date): Queryable<T>` — mode=AsOf, from=pointInTime
- `temporalAll(): Queryable<T>` — mode=All
- `temporalBetween(from: Date, to: Date): Queryable<T>` — mode=Between
- `temporalFromTo(from: Date, to: Date): Queryable<T>` — mode=FromTo
- `temporalContainedIn(from: Date, to: Date): Queryable<T>` — mode=ContainedIn

All clone `_model` (immutable chain pattern) and set `_model.temporal`.

### DbSet temporal delegates (`@ts-linq/orm`)

`packages/orm/src/DbSet.ts` — 5 delegate methods (section `// ─── Temporal API`) that call `newQueryable().temporalXxx(...)`.

### Metadata fluent API (`@ts-linq/orm` + `@ts-linq/metadata`)

- `EntityTypeBuilder.isTemporal(): this` — marks entity as temporal table
- `EntityTypeBuilder.withHistoryTable(name: string): this` — optional custom history table name
- `_applyToRegistry` calls `registry.mergeFluentTemporal(this._ctor, isTemporal, historyTableName)`
- `MetadataRegistry.mergeFluentTemporal(target, isTemporal, historyTableName?)` — new method
- `EntityMetadataBuilder.setTemporal(bool)` + `setHistoryTableName(name)` — new builder methods

### SQL emitter (`@ts-linq/dialect-mssql`)

- NEW FILE: `packages/dialect-mssql/src/emit-temporal.ts`
  - `buildTemporalClause(temporal: TemporalClause, params: SqlParameter[]): string`
  - Appends date params to `params[]` using `?` placeholders (renumbered to `@p1..@pN` by `numberPlaceholders`)
  - Returns SQL fragment: `' FOR SYSTEM_TIME AS OF ?'` etc.
- `MssqlDialect.buildSelect` — calls `buildTemporalClause` after `FROM [table]` (only in non-rawSqlSource path)
- `packages/dialect-mssql/src/index.ts` — exports `emit-temporal`

### NotSupported guards (`@ts-linq/dialect-postgres`, `@ts-linq/dialect-mysql`)

- `PostgresDialect.buildSelect` — throws `TemporalNotSupportedError` if `options.temporal` is set
- `MysqlDialect.buildSelect` — same guard

### Important note: rawSqlSource

When `options.rawSqlSource` is set, the temporal clause is **NOT** appended (the source is a derived table, not a real table). This matches EF Core behaviour.

## SQL generated

```sql
-- AsOf
SELECT * FROM [employees] FOR SYSTEM_TIME AS OF @p1

-- All
SELECT * FROM [employees] FOR SYSTEM_TIME ALL

-- Between
SELECT * FROM [employees] FOR SYSTEM_TIME BETWEEN @p1 AND @p2

-- FromTo
SELECT * FROM [employees] FOR SYSTEM_TIME FROM @p1 TO @p2

-- ContainedIn
SELECT * FROM [employees] FOR SYSTEM_TIME CONTAINED IN (@p1, @p2)
```

## Tests

- Unit: `packages/query/tests-new/TemporalQueryable.test.ts` — Queryable API and QueryModel.clone
- Integration (no DB): `packages/integration-tests/tests-new/01-query-provider/temporal-dialect.test.ts` — SQL emission + NotSupported errors
- Integration (live MSSQL, gated by MSSQL_URL): `packages/integration-tests/tests-new/mssql/mssql.temporal.integration.test.ts`
- E2E (gated by SKIP_DB_TESTS and MSSQL_URL): `packages/e2e-tests/tests/queries/temporal.e2e.test.ts`

## Known limitations / follow-up

- `options.temporal` is ignored when `rawSqlSource` is active (the derived table path)
- Non-MSSQL dialects throw at translation time (not compile time) — same as EF Core
- `ef.property<Date>(e, 'PeriodStart')` in `orderBy` works via `orderBy('SysStart')` (string column), not compile-time transformer

## Documentation

- `apps/docs/temporal-queries.md`
- `project-documents/tasks/dev-plans/P2-36-temporal-queries.md` (status: done)
