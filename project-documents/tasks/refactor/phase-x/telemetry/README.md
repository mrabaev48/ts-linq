# Refactor Audit: telemetry

## Package responsibility

`@ts-linq/telemetry` provides the ORM's OpenTelemetry integration and structured
diagnostics. It contains:

- `TelemetryProvider` (`src/provider/TelemetryProvider.ts`) — a `SqlLogger` that
  turns each ORM event into an OTel span.
- `DiagnosticEmitter` (`src/diagnostic-emitter.ts`) — a `SqlLogger` that formats
  events as text to a sink, applies log-level filtering, parameter masking, and
  warning escalation.
- Supporting utilities: `parameter-masker`, `warning-router`
  (`WarningConfigurationBuilder` + `EfWarningError`), `tag-span-attributes`
  (`parseTagsFromSql`), `event-ids`.

## Current architectural problems

1. **`DiagnosticEmitter` silently discards half the event vocabulary.** Eight of
   its `SqlLogger` methods (`cache`, `connectionHealth`, `circuit`, `fallback`,
   `hedgedWin`, `analysis`, `crossQuery`, `cacheSize`) are empty bodies with a
   "not forwarded by default" comment. There is no opt-in to surface them, so a
   user who configures `logTo()` and expects to see circuit-open or
   graceful-degradation/fallback events gets nothing — operationally important
   events vanish with no toggle.
2. **`DiagnosticEmitter` text methods route with an empty event id.** `debug`,
   `info`, `warn`, `error` all call `this.route('', ...)`, so the per-event
   warning route table can never match them and `''` is a magic value.
3. **Duplicated SQL-masking logic.** The exact same string-redaction regex pair
   plus `maskPatterns` loop appears in `TelemetryProvider.mask`
   (`provider/TelemetryProvider.ts:53`) and is re-implemented verbatim in
   `open-telemetry-sql-logger` and `prometheus-sql-logger`. Masking belongs in
   one shared utility (this package already owns `parameter-masker`).
4. **`TelemetryProvider` does NOT implement `cacheSize`/`crossQuery`** even
   though it implements the rest — it declares `implements SqlLogger` but the
   interface marks those optional, so the gap is silent (ISP/optional-method
   sprawl across the whole `SqlLogger` family — see the cross-package note).

`TelemetryProvider` itself (~266 LOC) is NOT a god class: each method maps one
ORM event to one span with no shared mutable state beyond the two span maps. Its
size is inherent fan-out, not an SRP violation. The real telemetry debt is the
silent-discard emitter and duplicated masking.

## Refactor goals

- Give `DiagnosticEmitter` a configurable, opt-in path for the currently-discarded
  resilience/cache events (Null-Object default stays "off", but make it routable).
- Replace the magic `''` event id with real ids and route text logs correctly.
- Extract SQL masking into one shared utility consumed by all three span/metric
  loggers.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | ✅ task-1.md — Make DiagnosticEmitter's discarded resilience/cache events routable (no silent discard) | P1 | Operationally important events are invisible with no opt-in |
| 2 | ✅ task-2.md — Extract shared SQL-masking utility; remove triplicated regex masking | P1 | Same redaction copy-pasted in 3 loggers; security-sensitive |
| 3 | ✅ task-3.md — Fix DiagnosticEmitter text logging routing through empty-string event id | P2 | Magic value; warning routes never apply to text logs |

> ✅ **Package complete.** All telemetry refactor tasks (1–3) are done.

## Dependencies on other packages

- `@ts-linq/types` only (event info types, `SqlLogger`, `DiagnosticConfig`,
  `WarningBehavior`).
- Conceptually the "reference" `SqlLogger` family member; the masking duplication
  links it to `open-telemetry-sql-logger` and `prometheus-sql-logger`.

## Testing strategy

- Unit: each `DiagnosticEmitter` event routes/suppresses per config; new opt-in
  surfaces resilience events when enabled and stays silent by default.
- Unit: shared masking utility (single test suite) covers quoted-string redaction
  and custom `maskPatterns`, including invalid-regex resilience.
- Existing `TelemetryProvider.tags`, `diagnostic-emitter`, `parameter-masker`,
  `warning-router`, `tagSpanAttributes` tests must keep passing.

## Notes

This package is the cleanest of the observability set; `WarningConfigurationBuilder`
(Builder pattern) and `parseTagsFromSql` are well-factored. The findings are
targeted, not structural.
