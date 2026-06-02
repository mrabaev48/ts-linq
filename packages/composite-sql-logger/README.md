# @ts-linq/composite-sql-logger

> Composite `SqlLogger` (and factory) for ts-linq — fan one logging stream out to many loggers.

A `SqlLogger` (from `@ts-linq/types`) that wraps a list of child loggers and forwards every event
to all of them. Use it to send SQL diagnostics to, say, the console **and** Prometheus **and**
OpenTelemetry at once.

## Installation

```bash
pnpm add @ts-linq/composite-sql-logger
# requires @ts-linq/core as a peer
```

## What lives here

- **`CompositeSqlLogger`** (`logger/CompositeSqlLogger.ts`) — forwards each event to all children.
- **`CompositeSqlLoggerFactory`** (`logger/CompositeSqlLoggerFactory.ts`) — `SqlLoggerFactory` that
  builds composites.

## Usage

```ts
import { CompositeSqlLogger } from '@ts-linq/composite-sql-logger';

const logger = new CompositeSqlLogger([
  new PrometheusSqlLogger(),
  new OpenTelemetrySqlLogger(),
]);
```

## Package structure

```
src/
  logger/CompositeSqlLogger.ts
  logger/CompositeSqlLoggerFactory.ts
  index.ts
```

## Dependencies

- `@ts-linq/types`
- `@ts-linq/core` (peer)

## License

Part of the ts-linq monorepo. See the repository root for license details.
