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

- **Cache metric helpers** (`lib/MetricsSafe.ts`) — guarded functions that record cache telemetry
  on an optional logger and silently no-op when no backend is configured:
  `safeCache`, `safeCacheSize`, `safeCacheEvicted`, plus `warnIfLoggerDebug` for opt-in debug
  diagnostics.
- **`MemoryProfiler`** (`lib/MemoryProfiler.ts`) — a lightweight memory sampler. Exposes the
  `MemoryProfiler` class together with the `MemorySample` and `MemoryProfilerOptions` types.

## Usage

```ts
import { safeCache, MemoryProfiler } from '@ts-linq/metrics-safe';

// Safe even when `logger` is undefined or has no cache handler — never throws.
safeCache(logger, { cache: 'sqlGen', hit: true });

// Sample process memory on demand.
const profiler = new MemoryProfiler({ sampleIntervalMs: 5_000 });
const sample = await profiler.sample();
console.log(sample.heapPressure);
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
