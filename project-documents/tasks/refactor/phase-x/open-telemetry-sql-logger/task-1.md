---
status: not-started
phase: phase-x
package: open-telemetry-sql-logger
priority: P1
effort: S
risk: medium
category: error-handling
depends_on: []
related: ["telemetry/task-2.md"]
---

# Refactor: Mask or omit bound parameters in OpenTelemetry spans

## Problem
`OpenTelemetrySqlLogger.queryStart` records the bound parameter values verbatim
as a span attribute, regardless of the `maskSql` setting. The masking option
only redacts the SQL text, giving a false sense of safety: an operator who
enables `maskSql` to keep PII out of traces still leaks every parameter value.

## Evidence
- `packages/open-telemetry-sql-logger/src/logger/OpenTelemetrySqlLogger.ts:82-88`
  — `queryStart` builds attributes including
  `'db.parameters': JSON.stringify(info.params ?? [])` unconditionally.
- `packages/open-telemetry-sql-logger/src/logger/OpenTelemetrySqlLogger.ts:47-60`
  — `mask()` only transforms the SQL string; it is never applied to `info.params`.
- By contrast `@ts-linq/telemetry`'s `TelemetryProvider.queryStart`
  (`packages/telemetry/src/provider/TelemetryProvider.ts:74-92`) records only
  `db.parameters.count`, never the values — the two siblings disagree on the
  privacy contract.

## Why this is bad
- Security/privacy: parameter values frequently contain PII, credentials, tokens.
  Tracing backends are widely accessible and long-retained.
- Violates least-astonishment: `maskSql` implies "sensitive data is redacted".
- Inconsistent with the sibling `TelemetryProvider`, so behaviour depends on
  which exporter the user picked.

## Target architecture
- Single, explicit "sensitive data" policy applied uniformly to SQL text and
  parameters (Clean Code: one decision point, no hidden side effects).
- Default to safe: emit parameter *count* (and optionally typed placeholders),
  not values. Recording values requires an explicit opt-in flag mirroring the
  core `sensitiveDataEnabled` concept.
- Reuse the existing `maskParams` helper from `@ts-linq/telemetry`
  (`packages/telemetry/src/parameter-masker.ts`) once a shared masking utility
  exists (see telemetry/task-2), instead of re-implementing.

## Proposed refactor
1. Add `sensitiveDataEnabled?: boolean` (default `false`) to
   `OpenTelemetryLoggerOptions`.
2. When `false`, replace `db.parameters` with `db.parameters.count` (matching
   `TelemetryProvider`) or positional placeholders via the shared
   `maskParams`.
3. When `true`, record values (current behaviour) — explicit opt-in only.
4. Document the privacy contract in the option JSDoc.

## Suggested design patterns
- **Strategy** for parameter rendering (count / placeholders / raw) selected by
  the sensitivity flag — keeps `queryStart` free of conditionals and
  open for extension.
- **Null Object**: the default (no values) strategy is the safe default.

## Testing plan
- Unit: with default options, assert no parameter *value* appears in any span
  attribute; only `db.parameters.count` is present.
- Unit: with `sensitiveDataEnabled: true`, assert values are recorded.
- Error path: empty/undefined params still produce a valid attribute.

## Acceptance criteria
- [ ] Parameter values are not recorded unless `sensitiveDataEnabled` is true.
- [ ] Default behaviour matches `TelemetryProvider` (count only).
- [ ] Option JSDoc documents the privacy contract.
- [ ] Tests cover masked and unmasked paths.

## Refactor order
Do first — smallest, security-relevant, independent of the larger extraction.

## Notes
Coordinate the rendering helper with telemetry/task-2 so SQL + param masking
share one implementation.
