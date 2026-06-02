# @ts-linq/dialect-postgres

> PostgreSQL SQL dialect for ts-linq: SQL rendering, DDL strategy, JSON-path translation, batch
> syntax, schema introspection, and Postgres-specific functions (ltree, spatial).

The dialect implements the `SqlDialect` contract from `@ts-linq/types` and the emitter/translator
ports from `@ts-linq/sql-visitor`, producing Postgres-flavored SQL (`$1` parameters, `"ident"`
quoting, `ON CONFLICT` upserts, `->`/`->>` JSON access, etc.).

## Installation

```bash
pnpm add @ts-linq/dialect-postgres
```

## What lives here

- **`PostgresDialect`** — the dialect entry point.
- **`PostgresDdlStrategy`** — DDL generation for tables/columns/indexes/constraints.
- **Emitters** — `PgWhereEmitter`, `PgJoinEmitter`, `PgGroupEmitter`, `PgOrderEmitter`.
- **`PgIndexBuilder`**, **`PostgresOptionsBuilder`**.
- **JSON** — `json/JsonPathTranslator` (`->`/`->>`/`#>>`).
- **Batch / SP** — `batch-syntax.ts`, `sp-syntax.ts`.
- **Introspection** — `introspector.ts` (DB-first schema reading).
- **Functions** — `ltree-functions.ts`, `spatial-functions.ts`, `functions/index.ts`.

## Package structure

```
src/
  PostgresDialect.ts, PostgresDdlStrategy.ts, PostgresOptionsBuilder.ts
  emitters/Pg*Emitter.ts
  builders/PgIndexBuilder.ts
  json/JsonPathTranslator.ts
  batch-syntax.ts, sp-syntax.ts, introspector.ts
  ltree-functions.ts, spatial-functions.ts, functions/index.ts
  index.ts
```

## Dependencies

- `@ts-linq/metadata`, `@ts-linq/sql-visitor`, `@ts-linq/types`, `@ts-linq/core`

## License

Part of the ts-linq monorepo. See the repository root for license details.
