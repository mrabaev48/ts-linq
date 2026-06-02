# Refactor Audit: composite-sql-logger

## Package responsibility

`@ts-linq/composite-sql-logger` fans one ORM logging stream out to multiple
`SqlLogger`s. `CompositeSqlLogger` (Composite pattern) forwards every event to a
list of delegates, isolating each delegate's exceptions; `CompositeSqlLoggerFactory`
builds a composite from a mix of static loggers and per-provider
`SqlLoggerFactory`s.

## Current architectural problems

1. **15x copy-pasted fan-out + try/catch.** Every one of the 15 `SqlLogger`
   methods is the identical loop `for (const d of this.delegates) { try {
   d.<method>?.(args) } catch (e) { console.warn(...) } }`. The only variation is
   the method name and the warning string. This is the textbook case for a single
   generic dispatch helper.
2. **Interface drift — incomplete coverage.** `CompositeSqlLogger` implements only
   13 of the `SqlLogger` event methods. It is **missing `crossQuery` and
   `cacheSize`**, which ARE part of the `SqlLogger` interface
   (`types/src/index.ts:204-205`). Because both are optional, the omission is
   silent — a `crossQuery`/`cacheSize` event emitted by the ORM is dropped by the
   composite and never reaches any delegate. This defeats the whole point of the
   composite for those two events.
3. **`console.warn` on delegate error.** A failing delegate logs to stdout via
   `console.warn` (15 sites). A logging library swallowing+console-warning is the
   same observability anti-pattern flagged in the cache adapters: not routable,
   not level-controlled, pollutes consumer output.
4. **Factory swallows factory-creation errors silently.** `CompositeSqlLoggerFactory.create`
   wraps `f?.create(provider)` in `catch {}` (empty) — a misconfigured logger
   factory disappears with no signal.

## Refactor goals

- Collapse the 15 duplicated method bodies into one generic, type-safe dispatch.
- Bring `CompositeSqlLogger` to full `SqlLogger` coverage (add `crossQuery`,
  `cacheSize`) and prevent future drift.
- Make delegate/factory error handling routable instead of `console.warn`/silent.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Collapse 15 duplicated fan-out bodies into one generic dispatch | P1 | Pure duplication; also fixes drift root cause |
| 2 | task-2.md — Add missing crossQuery/cacheSize coverage + drift guard | P1 | Composite silently drops two real events today |
| 3 | task-3.md — Route delegate/factory errors instead of console.warn/silent catch | P2 | Library console.warn + silent factory swallow |

## Dependencies on other packages

- `@ts-linq/types` only (`SqlLogger`, `SqlLoggerFactory`, event info types).
- Sits above the concrete loggers (`telemetry`, `open-telemetry-sql-logger`,
  `prometheus-sql-logger`); its correctness depends on a stable, complete
  `SqlLogger` contract (see the cross-package ISP note in the manifest).

## Testing strategy

- Unit: every `SqlLogger` event reaches every delegate; a throwing delegate does
  not stop the others.
- Drift guard: a test that iterates all `SqlLogger` method keys and asserts the
  composite forwards each (catches future missing-method regressions).
- Factory: mixed factories + static loggers compose; a throwing factory is
  reported (after task-3), not silently dropped.

## Notes

`CompositeSqlLogger` is a correct Composite pattern in spirit but executed with
maximal duplication and an incomplete method set. The generic-dispatch refactor
both removes the boilerplate and structurally guarantees full coverage.
