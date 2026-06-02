---
status: not-started
phase: phase-x
package: prometheus-sql-logger
priority: P1
effort: L
risk: medium
category: architecture
depends_on: ["prometheus-sql-logger/task-2.md"]
related: ["prometheus-sql-logger/task-1.md"]
---

# Refactor: Split the PrometheusSqlLogger god class (registry / collector / label-extractor)

## Problem
`PrometheusSqlLogger` is a ~663-line class holding ~45 fields and four distinct
responsibilities in one unit: metric registry construction, `SqlLogger` event
handling, SQL parsing for labels, and lazy client/masking. This violates Single
Responsibility, makes the class hard to read and impossible to unit-test in
parts, and forces every change to touch one enormous file.

## Evidence
- The class body spans `packages/prometheus-sql-logger/src/logger/PrometheusSqlLogger.ts:51-663`.
- Registry construction: `initQueryMetrics` (116), `initCacheMetrics` (160),
  `initHealthMetrics` (195), `initCircuitMetrics` (221), `initAnalysisMetrics`
  (251), `initFallbackMetrics` (270), `initMemoryMetrics` (298).
- Event handling: `queryEnd` (369), `retry` (407), `transactionStart/End`
  (424/431), `cache` (439), `cacheSize` (457), `cacheEvicted` (471),
  `hedgedWin` (480), `connectionHealth` (493), `circuit` (508), `fallback`
  (539), `analysis` (639).
- SQL parsing (domain logic): `parseOperation` (624), `parseEntity` (628),
  `cleanIdentifier` (660).
- Cross-cutting state for transitions: `lastConnectionStatus` Map reused for both
  connection and circuit transitions (`.../PrometheusSqlLogger.ts:73, 518-522,
  594-601`) — two concerns sharing one map keyed by ad-hoc string prefixes
  (`circuit:${provider}`).

## Why this is bad
- SRP violation: four reasons to change, one class.
- Testability: you cannot test label mapping without constructing the entire
  metric registry and a `prom-client` double.
- The shared `lastConnectionStatus` map with prefixed keys is a fragile coupling
  between unrelated state machines.

## Target architecture (SOLID / Clean Architecture / composition-first)
- **MetricRegistry**: builds and owns the Prometheus metric instances
  (counters/histograms/gauges). One class per metric group or a registry object;
  no event logic.
- **EventCollector**: implements `SqlLogger`, receives canonical `*Info` events,
  maps them to registry updates. Depends on the registry abstraction (DI).
- **SqlLabelExtractor**: the operation/entity extraction (or removed entirely per
  task-1 if structured metadata is available). Pure, independently testable.
- **PromClientLoader / MaskingStrategy**: the lazy `require` and SQL masking.
- `PrometheusSqlLogger` becomes a thin facade that composes these.
- Replace the dual-purpose `lastConnectionStatus` with two explicit transition
  trackers (one per state machine).

## Proposed refactor
1. Extract `SqlLabelExtractor` (move `parseOperation`/`parseEntity`/
   `cleanIdentifier`) — pure functions/class, unit-tested.
2. Extract `MetricRegistry` owning the `initXxx` construction and exposing typed
   handles.
3. Make the `EventCollector` (the handlers) depend on the registry + extractor
   via constructor injection.
4. Split `lastConnectionStatus` into `connectionTransitionTracker` and
   `circuitTransitionTracker`.
5. Keep `PrometheusSqlLogger` as the public facade composing the above (API
   backward compatible).

## Suggested design patterns
- **Composition over a god object**; **Dependency Inversion** (collector depends
  on registry/extractor abstractions).
- **Visitor/Collector**: the event collector visits each event type and emits
  registry updates — exactly the "extract a visitor/collector" goal.
- **Builder**: the metric registry constructs the metric set.
- **Facade**: `PrometheusSqlLogger` preserves the public constructor/API.

## Testing plan
- Unit-test `SqlLabelExtractor` against many SQL shapes (no prom-client needed).
- Unit-test `EventCollector` with a fake registry: assert each event increments
  the right metric with the right (bounded) labels.
- Unit-test `MetricRegistry` with a fake `PromClientLike`: asserts metric
  names/labelNames/buckets.
- Regression: existing `PrometheusSqlLogger.test.ts` /
  `PrometheusAnalysis.test.ts` pass via the facade.

## Acceptance criteria
- [ ] Registry, collector, and label extraction live in separate units.
- [ ] `PrometheusSqlLogger` is a thin facade; public API unchanged.
- [ ] Connection and circuit transition state are tracked separately.
- [ ] Each unit is unit-tested in isolation.
- [ ] No regression in existing tests.

## Refactor order
After task-2 (types) and ideally after task-1 (cardinality), so the extracted
collector already uses bounded labels and canonical types.

## Notes
Largest task in the cluster. Keep the public constructor signature stable to
avoid a breaking change to consumers.
