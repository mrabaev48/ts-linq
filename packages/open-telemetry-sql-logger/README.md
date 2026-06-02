# @ts-linq/open-telemetry-sql-logger

> OpenTelemetry `SqlLogger` implementation for ts-linq (optional package).

A drop-in `SqlLogger` (from `@ts-linq/types`) that emits OpenTelemetry spans for SQL execution. Add
it to your `DbContext` logging configuration to get distributed tracing of queries.

## Installation

```bash
pnpm add @ts-linq/open-telemetry-sql-logger
# requires @ts-linq/core as a peer + an OpenTelemetry SDK
```

## What lives here

- **`OpenTelemetrySqlLogger`** (`logger/OpenTelemetrySqlLogger.ts`) — `SqlLogger` implementation
  that opens/closes spans around query execution and records query metadata.

## Usage

```ts
import { OpenTelemetrySqlLogger } from '@ts-linq/open-telemetry-sql-logger';

const options = new DbContextOptionsBuilder()
  .logTo(new OpenTelemetrySqlLogger())
  .build();
```

## Package structure

```
src/
  logger/OpenTelemetrySqlLogger.ts
  index.ts
```

## Dependencies

- `@ts-linq/types`
- `@ts-linq/core` (peer)

## License

Part of the ts-linq monorepo. See the repository root for license details.
