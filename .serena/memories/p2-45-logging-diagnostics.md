# P2-45 — Logging / Diagnostics (implemented 2026-05-27)

## Summary
Adds EF Core-mirroring diagnostic API to `ts-linq`:
- `DbContextOptionsBuilder.logTo(sink, level?)` — routes events to user sink
- `DbContextOptionsBuilder.enableSensitiveDataLogging()` — exposes raw params (default: masked)
- `DbContextOptionsBuilder.enableDetailedErrors()` — appends stack traces to errors
- `DbContextOptionsBuilder.configureWarnings(w => w.throw(...).log(...).suppress(...))` — per-event routing

## New files
- `packages/types/src/index.ts` — added `LogLevel`, `WarningBehavior`, `DiagnosticConfig` types
- `packages/core/src/types/index.ts` — added `logging?: DiagnosticConfig` to `DbContextOptions`; `attachLogger(extra: SqlLogger)` to `IDatabaseProvider`
- `packages/core/src/DatabaseProvider.ts` — added `attachLogger()` public method + `mergeLoggers()` static helper
- `packages/telemetry/src/event-ids.ts` — `CoreEventId`, `RelationalEventId` string constants
- `packages/telemetry/src/parameter-masker.ts` — `maskParams()` function
- `packages/telemetry/src/warning-router.ts` — `WarningConfigurationBuilder`, `EfWarningError`
- `packages/telemetry/src/diagnostic-emitter.ts` — `DiagnosticEmitter` implements `SqlLogger`
- `packages/orm/src/options/log-to.ts`, `enable-sensitive-data-logging.ts`, `configure-warnings.ts` — re-export helpers
- `apps/docs/logging-diagnostics.md` — user documentation

## Architecture decisions
- `DiagnosticEmitter` is the single control point: masking → level filtering → warning routing → sink
- Parameters masked by default; `'log'` behavior forces output regardless of level
- `attachLogger()` composes loggers inline (no extra package dep)
- `@ts-linq/orm` gained `@ts-linq/telemetry` as workspace dependency

## Test coverage
- 3 unit test files in packages/telemetry/tests-new/ (42 tests)
- 1 integration test in packages/integration-tests/tests-new/04-telemetry-resilience/ (9 tests)

## Status: DONE
