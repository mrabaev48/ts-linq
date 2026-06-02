---
status: not-started
phase: phase-x
package: prometheus-sql-logger
priority: P2
effort: S
risk: medium
category: package-boundary
depends_on: []
related: ["metrics-safe/task-2.md", "cache/task-3.md"]
---

# Refactor: Formalize `cacheEvicted` in the SqlLogger contract

## Problem
`cacheEvicted` is invoked across packages but is not part of the published
`SqlLogger` interface. It is a duck-typed extension implemented ad-hoc here and
called via `metrics-safe`, making the cache-eviction metric flow invisible to the
type system and to any other `SqlLogger` implementation.

## Evidence
- `PrometheusSqlLogger.cacheEvicted?(...)` implemented:
  `packages/prometheus-sql-logger/src/logger/PrometheusSqlLogger.ts:471-478`.
- Invoked by `safeCacheEvicted`:
  `packages/metrics-safe/src/lib/MetricsSafe.ts:51-56` (via `tryInvoke(logger,
  'cacheEvicted', …)`, line 11).
- Called from the base entity cache on eviction:
  `packages/cache/src/EntityCache.ts:49`.
- NOT declared on `SqlLogger`: `packages/types/src/index.ts:192-206` lists
  `cache`, `cacheSize`, etc., but no `cacheEvicted`. (Compare: `cacheSize` *is*
  on the interface and *is* implemented by `TelemetryProvider`/composite.)

## Why this is bad
- A real `SqlLogger` event is reachable only via stringly-typed reflection
  (`tryInvoke(logger, 'cacheEvicted', …)`), bypassing the type contract.
- Other loggers (`TelemetryProvider`, `OpenTelemetrySqlLogger`,
  `CompositeSqlLogger`) cannot type-safely participate in eviction telemetry —
  `CompositeSqlLogger` does not fan `cacheEvicted` out at all.
- Inconsistent with the sibling `cacheSize` event, which *is* a first-class
  contract method.

## Target architecture
- `cacheEvicted` is either (a) promoted to an optional method on the canonical
  `SqlLogger` interface in `@ts-linq/types` (preferred — symmetry with
  `cacheSize`), with a `CacheEvictedInfo` payload type; or (b) explicitly folded
  into the existing `cache`/`cacheSize` events if it does not warrant its own
  method. The decision must be made deliberately, not left duck-typed.

## Proposed refactor
1. Add `cacheEvicted?(info: CacheEvictedInfo): void` and `CacheEvictedInfo`
   `{ cache: 'sqlGen' | 'entityL2' | 'count'; provider?: string }` to
   `@ts-linq/types` (mirrors the existing `cacheEvicted` payload shape here).
2. Type `PrometheusSqlLogger.cacheEvicted` against it.
3. Add a `cacheEvicted` fan-out to `CompositeSqlLogger`
   (see composite-sql-logger/task-2 for the missing-method audit).
4. Keep `metrics-safe.safeCacheEvicted` but have it target the now-typed method.

## Suggested design patterns
- **Interface Segregation / contract completeness**: the telemetry event surface
  is fully declared in `@ts-linq/types`; no out-of-band methods.

## Testing plan
- Type test: `PrometheusSqlLogger implements SqlLogger` includes `cacheEvicted`.
- Contract test: composite fans `cacheEvicted` to all delegates.
- Integration: eviction in `EntityCache`/adapters triggers the metric.

## Acceptance criteria
- [ ] `cacheEvicted` (or its replacement) is a declared `SqlLogger` member.
- [ ] `CompositeSqlLogger` fans it out.
- [ ] `safeCacheEvicted` targets the typed method.
- [ ] Eviction telemetry is type-checked end to end.

## Refactor order
Independent; coordinate with the `@ts-linq/types` owner and composite-sql-logger.

## Notes
This is a cross-cluster contract change (types + cache + composite + metrics-safe
+ prometheus). Scope is small but touches multiple packages — validate the whole
monorepo. Related to cache/task-3 and metrics-safe/task-2.
