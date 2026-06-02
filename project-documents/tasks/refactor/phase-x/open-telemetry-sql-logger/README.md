# Refactor Audit: open-telemetry-sql-logger

## Package responsibility

`@ts-linq/open-telemetry-sql-logger` (`packages/open-telemetry-sql-logger`,
`version 6.0.0`, `private`) provides a `SqlLogger` implementation
(`OpenTelemetrySqlLogger`, `src/logger/OpenTelemetrySqlLogger.ts`) that maps ORM
query/transaction/analysis events onto OpenTelemetry spans via
`@opentelemetry/api`. It optionally redacts SQL text before recording it as a
`db.statement` span attribute. `@opentelemetry/api` is loaded lazily through a
guarded `require()` so the dependency is effectively a soft/peer dependency.

## Current architectural problems

1. **Near-duplicate of `@ts-linq/telemetry`'s `TelemetryProvider`.**
   `OpenTelemetrySqlLogger` and `TelemetryProvider`
   (`packages/telemetry/src/provider/TelemetryProvider.ts`) are two
   independently-maintained OTel span mappers. They duplicate: the span-handle
   map keyed by `traceId` (`OpenTelemetrySqlLogger.ts:36` vs
   `TelemetryProvider.ts:42`), the SQL masking regex (`mask`,
   `OpenTelemetrySqlLogger.ts:47` vs `TelemetryProvider.ts:53`), the
   `SpanLike`/`TracerLike` shapes, and the OTel status-code constants
   (`OpenTelemetrySqlLogger` hardcodes `1`/`2` at lines 108/110 while
   `TelemetryProvider` names them `STATUS_OK`/`STATUS_ERROR`).
   The two implementations have already drifted (TelemetryProvider implements
   far more events; this logger only implements `queryStart`/`queryEnd`/`analysis`).

2. **Inline structural types instead of the shared `@ts-linq/types` contracts.**
   `queryStart`/`queryEnd`/`analysis` re-declare their `info` parameter shapes
   inline (`OpenTelemetrySqlLogger.ts:75`, `:92`, `:118`) instead of using
   `QueryStartInfo`/`QueryEndInfo`/`QueryAnalysisInfo` from `@ts-linq/types`.
   The contract can silently drift from the canonical event types.

3. **Sensitive-data leak risk — parameters are never masked.** `queryStart`
   records `'db.parameters': JSON.stringify(info.params ?? [])`
   (`OpenTelemetrySqlLogger.ts:86`) unconditionally. `maskSql` redacts the SQL
   text but the bound parameter values are emitted verbatim to the tracing
   backend regardless of any masking configuration.

4. **Silent `require` failure with no diagnostic.** `safeRequireOtel`
   (`OpenTelemetrySqlLogger.ts:17`) swallows the load error and the logger then
   silently does nothing on every event. There is no way for an operator to
   learn that tracing is silently disabled.

5. **Incomplete `SqlLogger` surface with no documented intent.** Only 3 of ~12
   event hooks are implemented; the absence of `transactionStart/End`, `cache`,
   `retry`, `circuit`, `fallback`, etc. is undocumented (intentional? partial?).

## Refactor goals

- Eliminate the duplicate OTel span-mapping logic shared with
  `@ts-linq/telemetry` by extracting one reusable span-mapping core (DRY /
  Single Responsibility), and have both packages compose it.
- Bind to the canonical `@ts-linq/types` event interfaces (no inline types).
- Make masking cover parameters, and make the "tracing disabled" state explicit
  (Null Object + observable diagnostic).

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Mask/omit bound parameters in spans | P1 | Sensitive-data leak; security-relevant, small surface |
| 2 | task-2.md — Bind to `@ts-linq/types` event interfaces, drop inline types | P1 | Stops contract drift; precondition for sharing the core |
| 3 | task-3.md — Extract shared OTel span-mapping core shared with telemetry | P1 | Removes cross-package duplication; biggest maintainability win |
| 4 | task-4.md — Make disabled-tracing state explicit (Null Object + diagnostic) | P2 | Observability of misconfiguration |

## Dependencies on other packages

- Imports `SqlLogger`, `SqlParameter` from `@ts-linq/types`; should also import
  the `*Info` event types from there.
- Soft-depends on `@opentelemetry/api` via lazy `require`.
- Conceptually overlaps heavily with `@ts-linq/telemetry` (`TelemetryProvider`)
  — see telemetry/task-2 (shared masking) and this package's task-3.

## Testing strategy

- Unit tests with a fake `TracerLike`/`SpanLike` asserting span name,
  attributes, status code, exception recording, and span lifecycle
  (start on `queryStart`, end+delete on `queryEnd`).
- Error-path test: `queryEnd` without a preceding `queryStart` (no span) must be
  a no-op.
- Security test: with and without `maskSql`, assert no raw literal/parameter
  value reaches span attributes.
- Contract test shared with `TelemetryProvider` once the span-mapping core is
  extracted.

## Notes

This package and `@ts-linq/telemetry` should be treated as one refactor unit for
the span-mapping concern. The existing `tests-new/OpenTelemetryLogger.test.ts`
should be preserved and extended rather than rewritten.
