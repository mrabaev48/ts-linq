# refactor/telemetry/task-2 — shared maskSql utility

✅ DONE — telemetry's 2ND task.

## What
Triplicated SQL-literal redaction (two literal regexes `/'(?:[^']|''+)*'/g` →
`'[REDACTED]'`, `/"(?:[^"\\]|\\.)*"/g` → `"[REDACTED]"`, plus a `maskPatterns`
loop with per-pattern `try/catch`) was copy-pasted into 3 `SqlLogger`s. Extracted
to ONE shared pure util.

## Host decision (confirmed via arch:deps)
Host = **`@ts-linq/types`**, in **`runtime.ts`** (the only behaviour-carrying module
per types CLAUDE.md; barrel `export * from './runtime'` makes it public
automatically — index.ts untouched). All three loggers depend ONLY on
`@ts-linq/types` → zero new edges. Hosting in `telemetry` would force the two
sibling loggers to add an illegal `telemetry` dep. `maskParams` stays in telemetry
(siblings don't use it) — asymmetry accepted, dep-graph wins.

Signature: `maskSql(sql: string, patterns?: ReadonlyArray<RegExp>): string`. Pure,
stateless, NO enable/disable flag (the flag is per-logger state). Never throws
(invalid pattern skipped).

## Call sites (delegate, byte-identical)
- `TelemetryProvider.mask` (telemetry)
- `OpenTelemetrySqlLogger.mask` (open-telemetry-sql-logger)
- `PrometheusSqlLogger.maskIfNeeded` (prometheus-sql-logger)
Each keeps its `if (!this.maskSql) return sql` guard + `maskPatterns` field, then
`return maskSqlLiterals(sql, this.maskPatterns)`. Import aliased
`maskSql as maskSqlLiterals` to avoid confusion with each class's `maskSql:boolean`
field. All internal call-sites unchanged (method kept as thin delegator).

## Tests
- Unit: `packages/types/tests/sql-masking.test.ts` — single/double quote, doubled
  `''` + backslash-escaped quotes, custom patterns, empty/undefined no-op, invalid
  regex (poisoned `Symbol.replace`) does not throw, security fixture
  (`super-secret-pw` absent).
- Contract (observable `db.statement` === `maskSql(input, patterns)`):
  `telemetry/tests-new/TelemetryProvider.masking.test.ts` +
  `open-telemetry-sql-logger/tests-new/OpenTelemetryLogger.masking.test.ts`. These
  two expose SQL on the span → prove byte-identity to the canonical fn (transitive).
- Prometheus masked SQL is NOT externally observable (bounded labels, P0) →
  identity is STRUCTURAL (delegates to same fn); added
  `prometheus-sql-logger/tests-new/PrometheusMasking.test.ts` capturing-client
  leak test (secret never in any label; entity upper-cased `USERS`).
- Manifest: added `'maskSql'` to `packages/types/tests/type-exports.test.ts`
  expected value-exports list (else snapshot fails).

## Gotcha
- Must `pnpm --filter @ts-linq/types build` BEFORE running tests/typecheck —
  consumers resolve to dist.
- Don't run jest directly per-package (it picks up `dist/__tests__/*.js`); use root
  `pnpm test:unit` (jest.unit.config.js).

## Validation
typecheck ✅ (32), lint ✅ 0 errors, test:unit ✅ 356 suites / 3623 tests,
build ✅, arch:deps ✅ no violations (zero new edges), arch:cycles ✅, arch:dead ✅.
integration/e2e run manually (hang in CI/bg) — change is unit-level.

## Versions
types minor 4.6.0→4.7.0; telemetry/otel-logger/prom-logger patch; orm/cli patch
(internal dep bump).

## Coordination / follow-up
- `open-telemetry-sql-logger/task-2` + `prometheus-sql-logger/task-2` reference &
  now consume this shared util.
- NOT covered: dollar-quoted Postgres strings (`$$...$$`) — pre-existing behaviour
  preserved (not masked); note as follow-up.

next telemetry = task-3 (DiagnosticEmitter empty-string event id).
