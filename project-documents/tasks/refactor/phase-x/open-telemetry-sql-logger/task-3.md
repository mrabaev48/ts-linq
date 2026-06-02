---
status: not-started
phase: phase-x
package: open-telemetry-sql-logger
priority: P1
effort: M
risk: medium
category: architecture
depends_on: ["open-telemetry-sql-logger/task-2.md", "telemetry/task-2.md"]
related: ["telemetry/task-1.md"]
---

# Refactor: Extract a shared OpenTelemetry span-mapping core shared with telemetry

## Problem
`OpenTelemetrySqlLogger` and `@ts-linq/telemetry`'s `TelemetryProvider` are two
parallel implementations of the same concern — mapping ORM `SqlLogger` events
onto OpenTelemetry spans. They duplicate the span-handle map, the SQL masking,
the `Tracer`/`Span` structural shapes, and the OTel status codes, and they have
already drifted in coverage and behaviour.

## Evidence
- Span-handle maps keyed by `traceId`:
  `packages/open-telemetry-sql-logger/src/logger/OpenTelemetrySqlLogger.ts:36`
  (`spanByTraceId`) vs
  `packages/telemetry/src/provider/TelemetryProvider.ts:42` (`querySpans`).
- Duplicated mask logic:
  `OpenTelemetrySqlLogger.ts:47-60` vs `TelemetryProvider.ts:53-66`
  (identical regexes).
- Status codes: `OpenTelemetrySqlLogger` hardcodes `code: 2`/`code: 1`
  (`OpenTelemetrySqlLogger.ts:108,110`) while `TelemetryProvider` names them
  `STATUS_ERROR`/`STATUS_OK` (`TelemetryProvider.ts:31-32`).
- Coverage drift: `TelemetryProvider` implements `cache`, `retry`,
  `transactionStart/End`, `circuit`, `fallback`, `hedgedWin`, `crossQuery`,
  `cacheSize`, `connectionHealth`; this package implements only
  `queryStart`/`queryEnd`/`analysis`.

## Why this is bad
- Two sources of truth for span attribute names (`db.statement`, `db.rows`,
  `db.duration_ms`, …) → backends receive inconsistent telemetry depending on
  which logger is wired.
- Bug fixes and new events must be applied twice; in practice they have not been
  (the drift above proves it).
- Violates SRP/DRY and Clean Architecture (the span-mapping policy is a single
  cohesive responsibility split across two packages).

## Target architecture
- A single reusable span-mapping core that accepts an injected `TracerLike`
  abstraction and a masking strategy, and exposes the full `SqlLogger` surface.
- `TelemetryProvider` (in `@ts-linq/telemetry`) is the canonical home; the OTel
  package becomes a thin adapter that wires `@opentelemetry/api`'s real tracer
  into that core (Adapter pattern), or is collapsed entirely into
  `@ts-linq/telemetry` if no distinct responsibility remains.
- Shared OTel status-code constants and shared masking (telemetry/task-2) used
  by both.

## Proposed refactor
1. Promote the span-mapping logic in `TelemetryProvider` to a reusable unit
   parameterized by a `TracerLike` provider and a `MaskingStrategy`.
2. Replace `OpenTelemetrySqlLogger`'s hand-written span logic with construction
   of that core, passing `otel.trace.getTracer(serviceName)` as the tracer.
3. Centralize OTel status codes in one exported constant.
4. Decide the fate of this package: thin adapter vs. fold into telemetry; if
   kept, document the distinct responsibility (lazy `@opentelemetry/api` wiring).

## Suggested design patterns
- **Adapter**: this package adapts the real `@opentelemetry/api` tracer to the
  core's `TracerLike` abstraction — its only legitimate distinct job.
- **Strategy**: masking strategy injected into the core (shared with siblings).
- **Template Method / composition**: the event-to-span mapping lives once.

## Testing plan
- Move the existing span-attribute assertions to a contract suite run against
  the shared core via a fake tracer.
- Adapter-level test: a fake `@opentelemetry/api` is wired and the core records
  the expected spans.
- Regression: `tests-new/OpenTelemetryLogger.test.ts` continues to pass against
  the adapter.

## Acceptance criteria
- [ ] Span-mapping logic exists in exactly one place.
- [ ] Masking and status codes are shared, not duplicated.
- [ ] `OpenTelemetrySqlLogger` is a thin adapter (or removed with a documented
      migration).
- [ ] No regression in existing OTel logger tests.

## Refactor order
After task-2 (types) and telemetry/task-2 (shared masking).

## Notes
This is a cross-package change; coordinate with the `@ts-linq/telemetry` owner.
Treat telemetry + open-telemetry-sql-logger as one refactor unit.
