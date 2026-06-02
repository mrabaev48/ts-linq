# @ts-linq/prometheus-sql-logger

> Prometheus `SqlLogger` implementation for ts-linq (optional package).

A `SqlLogger` (from `@ts-linq/types`) that records SQL execution metrics (counts, durations,
errors) as Prometheus time-series for scraping.

## Installation

```bash
pnpm add @ts-linq/prometheus-sql-logger
# requires @ts-linq/core as a peer + a Prometheus client
```

## What lives here

- **`PrometheusSqlLogger`** (`logger/PrometheusSqlLogger.ts`) — `SqlLogger` implementation that
  increments counters/histograms for query execution.

## Usage

```ts
import { PrometheusSqlLogger } from '@ts-linq/prometheus-sql-logger';

const options = new DbContextOptionsBuilder()
  .logTo(new PrometheusSqlLogger())
  .build();
```

## ⚠️ Metric label cardinality

Be careful what you use as metric labels — labeling time-series by raw/parsed SQL or entity values
can produce unbounded cardinality and overwhelm Prometheus. Prefer bounded labels (operation type,
table name from metadata, status).

## Package structure

```
src/
  logger/PrometheusSqlLogger.ts
  index.ts
```

## Dependencies

- `@ts-linq/types`
- `@ts-linq/core` (peer)

## License

Part of the ts-linq monorepo. See the repository root for license details.
