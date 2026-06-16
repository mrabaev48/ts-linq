---
status: completed
phase: phase-x
package: telemetry
priority: P1
effort: M
risk: medium
category: clean-code
depends_on: []
related: ["open-telemetry-sql-logger/task-2.md", "prometheus-sql-logger/task-2.md"]
---

# Refactor: Extract shared SQL-masking utility; remove triplicated regex masking

## Problem

The same SQL redaction logic — two string-literal regexes plus a custom
`maskPatterns` loop with a try/catch around each `replace` — is copy-pasted into
three separate `SqlLogger` implementations. This is security-sensitive code
(it prevents leaking literal values into traces/metrics) duplicated three times,
so a fix or hardening to the redaction must be made in three places.

## Evidence

Identical masking implementations:

- `packages/telemetry/src/provider/TelemetryProvider.ts:53-66` (`mask`).
- `packages/open-telemetry-sql-logger/src/logger/OpenTelemetrySqlLogger.ts:47-60`
  (`mask`).
- `packages/prometheus-sql-logger/src/logger/PrometheusSqlLogger.ts:612-623`
  (`maskIfNeeded`).

All three use the same regex pair
`/'(?:[^']|''+)*'/g` and `/"(?:[^"\\]|\\.)*"/g` → `[REDACTED]`, the same
`maskPatterns` loop, and the same per-pattern try/catch. `telemetry` also already
owns a related `parameter-masker.ts` (parameter redaction), so it is the natural
home.

## Why this is bad

- **DRY violation on security code.** Three copies of redaction; a missed edge
  case (e.g. dollar-quoted Postgres strings, escaped quotes) fixed in one logger
  silently leaves the other two leaking.
- **Inconsistency risk.** The copies can drift, producing different masking in
  spans vs metrics for the same query — confusing and a potential data-leak gap.
- **Scattered ownership.** No single tested unit for "redact SQL literals".

## Target architecture

One shared, well-tested masking utility, consumed by all three loggers via
**DRY** + **Single Responsibility**:

- Add `maskSql(sql: string, patterns?: ReadonlyArray<RegExp>): string` to
  `@ts-linq/telemetry` (alongside `maskParams`), or to `@ts-linq/types` if a
  dependency from the sibling logger packages onto `telemetry` is undesirable.
  (`open-telemetry-sql-logger` and `prometheus-sql-logger` currently depend only
  on `@ts-linq/types`; placing the util in `types` avoids adding a `telemetry`
  dependency — verify boundary rules before choosing.)
- Each logger calls the shared util; the per-logger `mask`/`maskIfNeeded`
  methods either delegate or are removed.

## Proposed refactor

1. Implement `maskSql` once (preferred location: `@ts-linq/types` to respect the
   existing dep graph of the consumer packages; confirm with `arch:deps`).
2. Add a dedicated unit-test suite for `maskSql` (single-quote, double-quote,
   escaped quotes, custom patterns, invalid regex resilience).
3. Replace `TelemetryProvider.mask`, `OpenTelemetrySqlLogger.mask`,
   `PrometheusSqlLogger.maskIfNeeded` with calls to the shared util.

## Suggested design patterns

- **Single Responsibility / DRY:** one redaction unit.
- **Pure function:** `maskSql` is stateless and trivially testable.

## Testing plan

- Unit: quoted-string redaction (single/double), embedded escaped quotes, no-op
  when `maskSql` disabled, custom `maskPatterns` applied, invalid regex in
  patterns does not throw.
- Regression: existing logger tests still pass with the shared util.
- Security: a fixture asserting a known literal does not appear in the masked
  output.

## Acceptance criteria

- [ ] One `maskSql` implementation exists; the three logger copies are removed or
      delegate to it.
- [ ] Dedicated test suite covers the redaction edge cases.
- [ ] `arch:deps`/`arch:cycles` remain clean (no new illegal dependency).
- [ ] Masked output is byte-identical across the three loggers for the same input.

## Refactor order

1. Decide host package (confirm with arch:deps).
2. Implement + test `maskSql`.
3. Replace the three copies.

## Notes

Joint with `open-telemetry-sql-logger/task-2` and `prometheus-sql-logger/task-2`,
which reference this shared util. `risk: medium` only because it touches a
security-sensitive code path in three packages at once — behaviour must be proven
identical.
