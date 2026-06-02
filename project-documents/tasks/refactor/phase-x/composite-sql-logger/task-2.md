---
status: not-started
phase: phase-x
package: composite-sql-logger
priority: P1
effort: S
risk: low
category: clean-code
depends_on: []
related: ["composite-sql-logger/task-1.md"]
---

# Refactor: Add missing crossQuery/cacheSize coverage + drift guard

## Problem

`CompositeSqlLogger` does not implement `crossQuery` or `cacheSize`, even though
both are part of the `SqlLogger` interface. Because both are optional methods, TS
does not flag the omission. The result: when the ORM emits a `crossQuery`
(IN-chunk batching) or `cacheSize` event, the composite silently drops it and no
delegate (Prometheus, OTel, telemetry) ever receives it — defeating the composite
for those two events.

## Evidence

- `SqlLogger` declares `crossQuery?(params: CrossQueryParams): void;` and
  `cacheSize?(params: CacheSizeInfo): void;` —
  `packages/types/src/index.ts:204-205`.
- `CompositeSqlLogger` implements `cache`, `connectionHealth`, `circuit`,
  `fallback`, `hedgedWin`, `analysis` (lines 101-154) but has **no** `crossQuery`
  or `cacheSize` method.
- Downstream loggers DO implement these: `PrometheusSqlLogger.cacheSize`
  (`prometheus-sql-logger/...:457`), `TelemetryProvider.cacheSize`/`crossQuery`
  (`telemetry/...:240,255`). So a real consumer exists, and the composite is the
  one breaking the chain.

## Why this is bad

- **Silent event loss.** Two real, emitted event types never propagate through the
  composite. Cache-size gauges and cross-query metrics simply never populate when
  a composite logger is configured.
- **ISP/contract incompleteness.** The composite claims `implements SqlLogger` but
  honours an incomplete subset; optionality hides the bug.
- **Drift will recur.** Without a structural guard, the next added `SqlLogger`
  method will be forgotten too.

## Target architecture

- Implement `crossQuery` and `cacheSize` (as one-liners over the generic
  `dispatch` from task-1).
- Add a **drift guard**: a test that enumerates the `SqlLogger` method names and
  asserts the composite forwards each to delegates, so any future interface
  addition fails the test until wired. Combined with the typed `dispatch`
  generic from task-1, this gives both compile-time and test-time protection.

This restores full **Composite** coverage and enforces **completeness** of the
contract.

## Proposed refactor

1. Add `crossQuery(params)` and `cacheSize(params)` forwarding to all delegates.
2. Add a coverage test driven by the set of `SqlLogger` event methods.

## Suggested design patterns

- **Composite:** complete the fan-out surface.
- **Contract test:** structural enumeration to prevent drift.

## Testing plan

- Unit: emitting `crossQuery`/`cacheSize` reaches every delegate that implements
  them.
- Drift guard: for each `SqlLogger` event method, a spy delegate receives the
  call through the composite.

## Acceptance criteria

- [ ] `CompositeSqlLogger` implements `crossQuery` and `cacheSize`.
- [ ] A drift-guard test enumerates `SqlLogger` events and asserts forwarding.
- [ ] No `SqlLogger` event is silently dropped by the composite.

## Refactor order

1. Land task-1 (generic dispatch) ideally first.
2. Add the two methods + drift-guard test.

## Notes

If task-1 lands first, these become trivial one-liners; if not, add them in the
existing repeated style and refactor later. The drift guard is the durable fix.
