---
status: not-started
phase: phase-x
package: telemetry
priority: P1
effort: M
risk: low
category: error-handling
depends_on: []
related: ["composite-sql-logger/task-2.md"]
---

# Refactor: Make DiagnosticEmitter's discarded resilience/cache events routable (no silent discard)

## Problem

`DiagnosticEmitter` implements the full `SqlLogger` interface but eight of its
event methods are empty no-ops that drop the event entirely, with no
configuration to opt in. Resilience and cache events — circuit-breaker state
changes, graceful-degradation fallbacks, hedged wins, connection health, cache
hit/miss/size, query analysis, cross-query chunking — are operationally the most
important things to log, yet `logTo()` users never see them and cannot turn them
on.

## Evidence

`packages/telemetry/src/diagnostic-emitter.ts`:

- `cache(_info)` — line 125, body `/* cache events are not forwarded ... */`.
- `connectionHealth(_info)` — line 129, no-op.
- `circuit(_info)` — line 133, no-op.
- `fallback(_info)` — line 137, no-op.
- `hedgedWin(_info)` — line 141, no-op.
- `analysis(_info)` — line 145, no-op.
- `crossQuery(_params)` — line 149, no-op.
- `cacheSize(_params)` — line 153, no-op.

The class otherwise has a working `route(eventId, level, message)` mechanism
(line 62) used by `queryStart`/`queryEnd`/`retry`/`transaction*`, with event ids
already catalogued in `event-ids.ts`. The infrastructure to route these events
exists; it simply is not wired for the eight discarded ones.

## Why this is bad

- **Silent-discard anti-pattern.** The richest diagnostic signal (a circuit
  opening, a fallback serving stale data) is unconditionally dropped. An operator
  enabling logging cannot discover degraded behaviour through the text sink.
- **No opt-in.** Unlike warning routing (which is configurable), these events
  have zero toggle — the discard is hard-coded.
- **Inconsistent with the package's own design.** `TelemetryProvider` emits spans
  for all of these; the text emitter arbitrarily forwards only a subset.

## Target architecture

Apply **Open/Closed** + **Null Object** correctly: default behaviour may stay
"off" (these can be verbose), but routing must be *configurable*, not hard-coded:

- Assign each event a real id in `event-ids.ts` (e.g. `core.circuit-open`,
  `core.fallback`, `relational.cross-query-chunk`, `core.cache`, `core.cache-size`,
  `core.connection-health`, `core.hedged-win`, `core.analysis`).
- Route each through the existing `route(eventId, level, message)` with a
  sensible default level (e.g. circuit-open = `warning`, cache hit = `trace`).
- Default minimum level (`information`) naturally suppresses the chatty ones while
  `circuit`/`fallback`/`connectionHealth` (warning/error) surface by default —
  which is the desired operational behaviour.
- Users can then `configureWarnings`/level to tune them, reusing the existing
  `WarningConfigurationBuilder`.

## Proposed refactor

1. Add event ids for the eight events to `event-ids.ts`.
2. Implement each method to format a concise message and call `route(...)` at the
   appropriate level (mirroring the span attributes `TelemetryProvider` already
   chooses, e.g. fallback `succeeded`/`isStale`, circuit `state`/`reason`).
3. Keep verbose events (`cache` hit/miss, `cacheSize`, `crossQuery`, `analysis`)
   at `trace`/`debug` so they stay off by default but become routable.
4. Document the new event ids.

## Suggested design patterns

- **Open/Closed:** new events routed through the existing extension point, not new
  bespoke logic.
- **Strategy (existing):** reuse `WarningConfigurationBuilder` for per-event
  control.

## Testing plan

- Unit: with default config, `circuit` (open) and `fallback` (failed) produce
  output; `cache` hit does not (level filtered).
- Unit: raising level to `trace` surfaces the verbose events.
- Unit: `configureWarnings().suppress('core.circuit-open')` silences it;
  `.throw(...)` escalates to `EfWarningError`.
- Regression: existing `diagnostic-emitter.test.ts` assertions unaffected.

## Acceptance criteria

- [ ] None of the eight events are hard-coded no-ops; all route through `route()`.
- [ ] Each has a real, catalogued event id.
- [ ] Default behaviour surfaces resilience events (warning/error) and suppresses
      verbose ones (trace/debug) via level — without code changes by the user.
- [ ] Per-event suppress/throw via `WarningConfigurationBuilder` works.

## Refactor order

1. Add event ids.
2. Wire each method to `route()`.
3. Tune default levels; add tests + docs.

## Notes

Classification: these empty bodies are an **invalid silent swallow** of
diagnostic signal (not error-recovery). The fix preserves "quiet by default" for
chatty events but removes the hard-coded, un-configurable discard of important
resilience events.
