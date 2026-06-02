# @ts-linq/metrics-safe

> Safe, dependency-free helpers for **optional** metrics and memory profiling in ts-linq.

This tiny package lets the rest of the ORM emit metrics and profile memory without taking a hard
dependency on any metrics backend. If no collector is wired up, the helpers degrade to no-ops, so
production code never crashes because telemetry is absent.

## Installation

```bash
pnpm add @ts-linq/metrics-safe
```

## What lives here

- **`MetricsSafe`** (`lib/MetricsSafe.ts`) — guarded entry points for recording metrics that
  silently no-op when no backend is configured.
- **`MemoryProfiler`** (`lib/MemoryProfiler.ts`) — lightweight memory sampling helpers.

## Usage

```ts
import { MetricsSafe } from '@ts-linq/metrics-safe';

// Safe even when no metrics backend is registered.
MetricsSafe.record('query.duration', durationMs);
```

## Package structure

```
src/
  lib/MetricsSafe.ts
  lib/MemoryProfiler.ts
  index.ts
```

## Dependencies

None (zero runtime dependencies by design).

## License

Part of the ts-linq monorepo. See the repository root for license details.
