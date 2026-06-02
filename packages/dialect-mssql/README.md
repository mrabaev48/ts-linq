# @ts-linq/dialect-mssql

> Microsoft SQL Server dialect for ts-linq: SQL rendering, DDL strategy, JSON-path translation,
> batch syntax, schema introspection, temporal tables, and MSSQL-specific functions (hierarchyid,
> spatial).

Implements the `SqlDialect` contract from `@ts-linq/types` and the emitter/translator ports from
`@ts-linq/sql-visitor`, producing T-SQL (`@p0` parameters, `[ident]` quoting, `MERGE` upserts,
`JSON_VALUE`/`JSON_QUERY` access, `hierarchyid`, temporal `FOR SYSTEM_TIME`, etc.).

## Installation

```bash
pnpm add @ts-linq/dialect-mssql
```

## What lives here

- **`MssqlDialect`**, **`MssqlDdlStrategy`**, **`MssqlOptionsBuilder`**.
- **Emitters** — `MssqlWhereEmitter`, `MssqlJoinEmitter`, `MssqlGroupEmitter`, `MssqlOrderEmitter`.
- **`MssqlIndexBuilder`**.
- **JSON** — `json/JsonPathTranslator` (`JSON_VALUE`/`JSON_QUERY`).
- **Temporal** — `emit-temporal.ts` (system-versioned tables).
- **Hierarchy / spatial** — `hierarchy-functions.ts`, `spatial-functions.ts`, `functions/index.ts`.
- **Batch / SP** — `batch-syntax.ts`, `sp-syntax.ts`.
- **Introspection** — `introspector.ts`.

## Package structure

```
src/
  MssqlDialect.ts, MssqlDdlStrategy.ts, MssqlOptionsBuilder.ts
  emitters/Mssql*Emitter.ts
  builders/MssqlIndexBuilder.ts
  json/JsonPathTranslator.ts
  emit-temporal.ts, hierarchy-functions.ts, spatial-functions.ts, functions/index.ts
  batch-syntax.ts, sp-syntax.ts, introspector.ts
  index.ts
```

## Dependencies

- `@ts-linq/metadata`, `@ts-linq/sql-visitor`, `@ts-linq/types`, `@ts-linq/core`

## License

Part of the ts-linq monorepo. See the repository root for license details.
