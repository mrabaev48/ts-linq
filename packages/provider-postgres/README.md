# @ts-linq/provider-postgres

> PostgreSQL database provider for ts-linq — the runtime that actually talks to a Postgres server.

This package implements the `DatabaseProvider` contract from `@ts-linq/core` on top of the Postgres
dialect. It manages connections/pooling, executes parameterized SQL, maps rows to entities, coerces
JS values to SQL parameters, handles transactions, classifies transient errors, and provides codecs
for spatial and `ltree` types.

## Installation

```bash
pnpm add @ts-linq/provider-postgres
# plus your Postgres driver (e.g. pg)
```

## What lives here

- **`PostgresProvider`** — the `DatabaseProvider` implementation (connect, query, transactions,
  batching, DDL execution, row mapping, parameter coercion).
- **`buildConnectionString`** — connection config → connection string.
- **Codecs** — `spatial-codec.ts` (WKB/WKT), `ltree-codec.ts`.
- **`transientErrorCodes.ts`** — Postgres error codes treated as retryable.

## Usage

```ts
import { PostgresProvider } from '@ts-linq/provider-postgres';

const provider = new PostgresProvider({ host, port, database, user, password });
const db = new AppDb({ provider });
```

## Package structure

```
src/
  PostgresProvider.ts
  buildConnectionString.ts
  spatial-codec.ts, ltree-codec.ts
  transientErrorCodes.ts
  index.ts
```

## Dependencies

- `@ts-linq/core`, `@ts-linq/dialect-postgres`, `@ts-linq/types`, `@ts-linq/metadata`
- Postgres driver loaded at runtime.

## License

Part of the ts-linq monorepo. See the repository root for license details.
