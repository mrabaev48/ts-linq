# @ts-linq/provider-mysql

> MySQL database provider for ts-linq — the runtime that actually talks to a MySQL server.

This package implements the `DatabaseProvider` contract from `@ts-linq/core` on top of the MySQL
dialect. It manages connections/pooling, executes parameterized SQL, maps rows to entities, coerces
JS values to SQL parameters, handles transactions, classifies transient errors, and provides a
spatial codec.

## Installation

```bash
pnpm add @ts-linq/provider-mysql
# plus your MySQL driver (e.g. mysql2)
```

## What lives here

- **`MySqlProvider`** — the `DatabaseProvider` implementation.
- **`buildConnectionString`** — connection config → connection string.
- **`spatial-codec.ts`** — WKB/WKT spatial value codec.
- **`transientErrorCodes.ts`** — MySQL error codes treated as retryable.

## Usage

```ts
import { MySqlProvider } from '@ts-linq/provider-mysql';

const provider = new MySqlProvider({ host, port, database, user, password });
const db = new AppDb({ provider });
```

## Package structure

```
src/
  MySqlProvider.ts
  buildConnectionString.ts
  spatial-codec.ts
  transientErrorCodes.ts
  index.ts
```

## Dependencies

- `@ts-linq/core`, `@ts-linq/dialect-mysql`, `@ts-linq/types`, `@ts-linq/metadata`
- MySQL driver loaded at runtime.

## License

Part of the ts-linq monorepo. See the repository root for license details.
