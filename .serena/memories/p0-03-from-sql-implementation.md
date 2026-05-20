# P0-03: FromSqlInterpolated / FromSqlRaw / DatabaseFacade — DONE

## Status
Merged via PR #87 (feat/p0-03-from-sql-interpolated → main)

## New public API

### `@ts-linq/orm`
- `sql` tagged template — creates `SqlInterpolated` (safe parameterisation)
- `SqlInterpolated` class — holds `fragments: string[]` + `values: unknown[]`
- `DbSet<T>.fromSqlInterpolated(query: SqlInterpolated): Queryable<T>`
- `DbSet<T>.fromSqlRaw(rawSql: string, ...values: unknown[]): Queryable<T>`
- `DatabaseFacade` class (accessed via `ctx.database`):
  - `executeSqlInterpolated(query: SqlInterpolated): Promise<number>`
  - `executeSqlRaw(rawSql: string, ...values): Promise<number>`
  - `sqlQuery<T>(query: SqlInterpolated, entityClass: new () => T): Queryable<T>`
  - `sqlQueryRaw<T>(rawSql: string, entityClass: new () => T, ...values): Queryable<T>`

### `@ts-linq/core`
- `DatabaseProvider.formatSqlWithParams(sql, params): { sql, params }` — non-abstract, default returns `?` style; Postgres overrides to `$N`, MSSQL to `@pN`

### `@ts-linq/types`
- `QueryOptions.rawSqlSource?: { sql: string; params: readonly SqlParameter[] }`

### `@ts-linq/query`
- `QueryModel.rawSqlSource` field (threaded through `clone()`)
- `QueryBuilder.generateFromModel()` propagates `rawSqlSource` to `QueryOptions`
- `Queryable._withRawSqlSource(raw): Queryable<T>` — @internal method

### `@ts-linq/ast`
- `RawSqlNode` interface — source-node, NOT part of `ExpressionNode` predicate union

## Architectural invariants

1. **Derived-table wrapping**: raw SQL emitted as `FROM (<userSql>) AS t0` — user SQL is never modified; LINQ operators layer on top
2. **Parameter ordering**: SELECT-params → rawSqlSource-params → WHERE-params (left-to-right `?` order in final SQL). `collectSelectParams` must be called BEFORE `rawSqlSource` params are pushed.
3. **Placeholder unification**: all raw SQL uses `?` internally; `numberPlaceholders` converts at end (Postgres `$N`, MSSQL `@pN`, MySQL stays `?`)
4. **`sqlQuery<T>` requires explicit `entityClass`**: TypeScript type erasure (documented difference from EF Core which uses C# reflection)
5. **TypeScript project references**: after editing `@ts-linq/types`, dependent packages need rebuild before typecheck picks up new types

## New files
- `packages/ast/src/nodes/RawSqlNode.ts`
- `packages/orm/src/sql/sqlTag.ts`
- `packages/orm/src/DatabaseFacade.ts`
- `packages/orm/tests-new/fromSql.test.ts` (27 tests)

## Validation outcome
All checks passed: typecheck (31/31), lint, test:unit (1809), test:integration (209), test:e2e (129), build (32), arch:deps, arch:cycles, arch:dead
