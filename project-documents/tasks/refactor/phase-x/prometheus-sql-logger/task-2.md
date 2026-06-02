---
status: not-started
phase: phase-x
package: prometheus-sql-logger
priority: P1
effort: S
risk: low
category: typescript
depends_on: []
related: ["open-telemetry-sql-logger/task-2.md"]
---

# Refactor: Bind handlers to @ts-linq/types event interfaces

## Problem
`PrometheusSqlLogger` re-declares the structural shape of every `SqlLogger` event
payload inline in its method signatures instead of importing the canonical
`*Info` interfaces from `@ts-linq/types`. The handlers can drift from the real
contract with no compile-time error, and they only loosely satisfy
`implements SqlLogger`.

## Evidence
- Inline payloads throughout, e.g.:
  - `queryEnd`: `packages/prometheus-sql-logger/src/logger/PrometheusSqlLogger.ts:369-377`
  - `cache`: `.../PrometheusSqlLogger.ts:439-444`
  - `cacheSize`: `.../PrometheusSqlLogger.ts:457-461`
  - `circuit`: `.../PrometheusSqlLogger.ts:508-514`
  - `fallback`: `.../PrometheusSqlLogger.ts:539-549`
  - `connectionHealth`: `.../PrometheusSqlLogger.ts:493-498`
  - `analysis`: `.../PrometheusSqlLogger.ts:639-647`
- Canonical interfaces exist in `packages/types/src/index.ts:192-206`
  (`CacheInfo`, `QueryEndInfo`, `CircuitEventInfo`, `FallbackInfo`,
  `ConnectionHealthInfo`, `QueryAnalysisInfo`, `CacheSizeInfo`, …).
- The class only imports `SqlLogger, SqlParameter`
  (`.../PrometheusSqlLogger.ts:1`), not the event types.

## Why this is bad
- Contract drift: a change to `CacheInfo` or `FallbackInfo` in `@ts-linq/types`
  won't surface here.
- The inline `fallback`/`circuit` shapes include fields not in the canonical
  type (e.g. `throttled`, `asOf`) — divergence that should be reconciled in the
  shared contract, not hidden in a private copy.
- Violates DRY and Dependency Inversion; inconsistent with `@ts-linq/telemetry`.

## Target architecture
- Handlers typed exclusively against `@ts-linq/types` event interfaces; any extra
  fields the exporter needs are added to the canonical contract, not duplicated.

## Proposed refactor
1. Import the relevant `*Info` types from `@ts-linq/types`.
2. Replace every inline event-payload type with the canonical named type.
3. For fields used here but absent from the canonical type (`throttled`,
   `isStale`, `asOf`, `source` on fallback), reconcile with the `@ts-linq/types`
   owner — add them to `FallbackInfo`/`CircuitEventInfo` or drop their use.

## Suggested design patterns
- **Dependency Inversion** on the published type contracts.

## Testing plan
- `pnpm typecheck` passes against canonical types.
- `implements SqlLogger` enforced; add a type-level test if the reconciliation
  changes any signatures.

## Acceptance criteria
- [ ] No inline event-payload object types remain in handler signatures.
- [ ] Extra fields are either in the canonical types or removed.
- [ ] `pnpm typecheck` passes.

## Refactor order
Do before task-3 (the split) so the extracted collector is typed correctly.

## Notes
Pairs with open-telemetry-sql-logger/task-2 — same anti-pattern, same fix.
