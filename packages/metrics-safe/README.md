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

- **Safe-invoke primitive** (`lib/MetricsSafe.ts`) — `safeInvoke(logger, method, ...args)`, a
  generic, type-safe guard over the `SqlLogger` contract: it type-checks the method name and its
  arguments, then invokes the (possibly absent, possibly throwing) method without ever propagating
  an error. Extend by *calling* it with another `SqlLogger` method name — no edit to a closed union
  (OCP).
- **`SafeSqlLogger`** — a Decorator that wraps any `SqlLogger` so every method is guarded once;
  callers hold a logger that "can never throw".
- **Cache metric helpers** (`lib/MetricsSafe.ts`) — guarded convenience functions that record cache
  telemetry on an optional logger and silently no-op when no backend is configured:
  `safeCache`, `safeCacheSize`, `safeCacheEvicted` (thin wrappers over the same guarded core), plus
  `warnIfLoggerDebug` for opt-in debug diagnostics.
- **`MemoryProfiler`** (`lib/MemoryProfiler.ts`) — a lightweight memory sampler. Exposes the
  `MemoryProfiler` class together with the `MemorySample` and `MemoryProfilerOptions` types.

## Usage

```ts
import { safeInvoke, SafeSqlLogger, safeCache, MemoryProfiler } from '@ts-linq/metrics-safe';

// Generic, type-safe: method name + args are checked against the SqlLogger contract.
safeInvoke(logger, 'fallback', { fallback: 'redis', attempted: true });

// Convenience wrapper — equivalent to safeInvoke for the cache event.
safeCache(logger, { cache: 'sqlGen', hit: true });

// Wrap a logger once so every method is guarded — it can never throw.
const safeLogger = new SafeSqlLogger(logger);
safeLogger.queryEnd({ sql, params, durationMs: 12 });

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

None at runtime (zero runtime dependencies by design). `safeInvoke`/`SafeSqlLogger` are typed
against `SqlLogger` via a **type-only** `import type` from `@ts-linq/types` (declared as a
devDependency); `import type` is fully erased at build time, so the emitted JavaScript imports
nothing and the runtime stays dependency-free.

## License

Part of the ts-linq monorepo. See the repository root for license details.
