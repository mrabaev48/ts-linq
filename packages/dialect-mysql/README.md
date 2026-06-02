# @ts-linq/dialect-mysql

> MySQL SQL dialect for ts-linq: SQL rendering, DDL strategy, JSON-path translation, batch syntax,
> schema introspection, sequence emulation, and MySQL-specific functions.

Implements the `SqlDialect` contract from `@ts-linq/types` and the emitter/translator ports from
`@ts-linq/sql-visitor`, producing MySQL-flavored SQL (`?` parameters, backtick `` `ident` ``
quoting, `ON DUPLICATE KEY UPDATE` upserts, `JSON_EXTRACT`/`->>` access, `LAST_INSERT_ID`, etc.).

## Installation

```bash
pnpm add @ts-linq/dialect-mysql
```

## What lives here

- **`MysqlDialect`**, **`MySqlDdlStrategy`**, **`MysqlOptionsBuilder`**.
- **Emitters** — `MySqlWhereEmitter`, `MySqlJoinEmitter`, `MySqlGroupEmitter`, `MySqlOrderEmitter`.
- **`MySqlIndexBuilder`**.
- **JSON** — `json/JsonPathTranslator`.
- **Batch / SP** — `batch-syntax.ts`, `sp-syntax.ts`.
- **Sequence emulation** — `sequenceEmulation.ts` (MySQL lacks native sequences → counter table).
- **Introspection** — `introspector.ts`.
- **Functions** — `spatial-functions.ts`, `functions/index.ts`.

## Package structure

```
src/
  MysqlDialect.ts, MySqlDdlStrategy.ts, MysqlOptionsBuilder.ts
  emitters/MySql*Emitter.ts
  builders/MySqlIndexBuilder.ts
  json/JsonPathTranslator.ts
  batch-syntax.ts, sp-syntax.ts, sequenceEmulation.ts, introspector.ts
  spatial-functions.ts, functions/index.ts
  index.ts
```

## Dependencies

- `@ts-linq/metadata`, `@ts-linq/sql-visitor`, `@ts-linq/types`, `@ts-linq/core`

## License

Part of the ts-linq monorepo. See the repository root for license details.
