# @ts-linq/provider-mssql

> Microsoft SQL Server database provider for ts-linq — the runtime that actually talks to a SQL
> Server instance.

This package implements the `DatabaseProvider` contract from `@ts-linq/core` on top of the MSSQL
dialect. It manages connections/pooling, executes parameterized T-SQL, maps rows to entities,
coerces JS values to SQL parameters, handles transactions, classifies transient errors, and
provides codecs for spatial and `hierarchyid` types.

## Installation

```bash
pnpm add @ts-linq/provider-mssql
# plus your SQL Server driver (e.g. mssql / tedious)
```

## What lives here

- **`MssqlProvider`** — the `DatabaseProvider` implementation.
- **`buildConnectionString`** — connection config → connection string.
- **Codecs** — `spatial-codec.ts` (WKB/WKT), `hierarchy-codec.ts` (`hierarchyid`).
- **`transientErrorCodes.ts`** — SQL Server error numbers treated as retryable.

## Usage

```ts
import { MssqlProvider } from '@ts-linq/provider-mssql';

const provider = new MssqlProvider({ server, database, user, password });
const db = new AppDb({ provider });
```

## Package structure

```
src/
  MssqlProvider.ts
  buildConnectionString.ts
  spatial-codec.ts, hierarchy-codec.ts
  transientErrorCodes.ts
  index.ts
```

## Dependencies

- `@ts-linq/core`, `@ts-linq/dialect-mssql`, `@ts-linq/types`, `@ts-linq/metadata`
- SQL Server driver loaded at runtime.

## License

Part of the ts-linq monorepo. See the repository root for license details.
