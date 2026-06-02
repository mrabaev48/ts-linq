---
status: not-started
phase: phase-x
package: open-telemetry-sql-logger
priority: P2
effort: S
risk: low
category: error-handling
depends_on: []
related: ["prometheus-sql-logger/task-4.md"]
---

# Refactor: Make disabled-tracing state explicit (Null Object + diagnostic)

## Problem
When `@opentelemetry/api` cannot be loaded, the logger silently becomes a
permanent no-op. The `require` error is swallowed and there is no signal to the
operator that tracing — which they explicitly opted into by constructing this
logger — is disabled.

## Evidence
- `packages/open-telemetry-sql-logger/src/logger/OpenTelemetrySqlLogger.ts:17-25`
  — `safeRequireOtel` catches and discards the load error
  (`// Silently fail if OpenTelemetry is not installed`).
- Constructor: `this.tracer = otel?.trace.getTracer(serviceName)`
  (`.../OpenTelemetrySqlLogger.ts:42`) leaves `tracer` undefined; every handler
  then early-returns (`queryStart` line 81, `analysis` line 136) producing no
  spans and no warning.

## Why this is bad
- Silent misconfiguration: the user wired an OTel logger but gets zero traces
  with no explanation — a classic "swallowed dependency" failure.
- Hard to diagnose in production; looks like the ORM "isn't emitting telemetry".

## Target architecture
- The "tracing unavailable" state is explicit and observable, while still being
  fail-safe (never throw from a logger). A Null-Object/no-op mode is acceptable
  but must be *announced once*, not hidden.

## Proposed refactor
1. On `require` failure, emit a single diagnostic via the same
   debug-gated channel pattern used by `@ts-linq/metrics-safe`
   (`warnIfLoggerDebug`, `packages/metrics-safe/src/lib/MetricsSafe.ts:58`) or an
   injected warning sink — not an unconditional `console`.
2. Optionally expose an `isEnabled()` accessor so callers/tests can assert state.
3. Document that the logger degrades to a no-op when `@opentelemetry/api` is
   absent.

## Suggested design patterns
- **Null Object**: an explicit `DisabledTracer` (no-op) makes the disabled state
  a first-class, testable object rather than scattered `?.`/early-returns.
- **Decorator/diagnostic**: a one-time gated warning instead of silent discard.

## Testing plan
- Unit: simulate `@opentelemetry/api` load failure; assert `isEnabled() === false`
  and that exactly one gated diagnostic is emitted (when debug enabled).
- Unit: handlers remain safe no-ops in disabled mode (no throw).

## Acceptance criteria
- [ ] Disabled-tracing state is observable (`isEnabled()` or equivalent).
- [ ] A single, debug-gated diagnostic is emitted on load failure.
- [ ] Logger never throws when disabled.
- [ ] Behaviour documented in the constructor JSDoc.

## Refactor order
Independent; can land any time. Pairs conceptually with the Prometheus
client-missing case (prometheus-sql-logger/task-4).

## Notes
Reuse the `metrics-safe` debug-gated warning convention for consistency across
the observability cluster.
