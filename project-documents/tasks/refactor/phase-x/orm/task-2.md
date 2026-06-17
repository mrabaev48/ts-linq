---
status: completed
phase: phase-x
package: orm
priority: P0
effort: M
risk: medium
category: error-handling
depends_on: []
related: ["task-1.md", "task-5.md"]
---

# Refactor: Eliminate silent and commented-out catch blocks in core paths

## Problem

Several `catch` blocks in `DbContext` swallow errors entirely, with the original
logging call commented out (`// logInternalError(...)`) after a logger removal.
Two of these are on the **commit/rollback** path — the most safety-critical code
in the ORM — and one is in `DbSet`. Errors during cache invalidation, profiler
shutdown, and metrics reporting vanish with no trace.

## Evidence

Classification of each cited catch:

- `DbContext.ts:534` — `commitTransaction` cache-invalidation catch → **invalid
  silent swallow.** After a real provider commit succeeds, cache invalidation
  failing is silently ignored; the cache can be left stale with zero signal.
- `DbContext.ts:557` — `rollbackTransaction` entity-cache size catch → **invalid
  silent swallow** (telemetry-only, but no rethrow and no log).
- `DbContext.ts:574` — `cache.warmUp` per-task catch → **arguably valid recovery**
  (warm-up is best-effort), but it must at minimum log; currently silent.
- `DbContext.ts:607` — `cache.reportMetrics` catch → **invalid silent swallow**
  (telemetry path; should be telemetry-with-rethrow or at least logged).
- `DbContext.ts:622` — `dispose` memoryProfiler.stop catch → **cleanup-with-
  swallow.** Acceptable to not rethrow during dispose, but must be logged.
- `DbContext.ts:339` — `ensureCreated` pre-warm `catch {}` (instantiate each
  entity) → **valid recovery** (constructors with side effects/args), but the
  empty catch hides genuine model-misconfiguration errors.
- `DbSet.ts:793` — `invalidateCountCache` `catch {}` → **invalid silent swallow**
  with an `// ignore` comment; cache-key drift becomes invisible.

The `logInternalError` import is commented out at `DbContext.ts:40`.

## Why this is bad

- Stale caches after commit produce wrong query results with no diagnostic.
- Silent swallows defeat observability; production incidents become
  unreproducible.
- The commented-out logging signals an unfinished migration left in core code.
- Violates the project error model (no silent swallow; cause preservation;
  telemetry-with-rethrow or explicit recovery).

## Target architecture

Adopt the project's typed error model and a single internal diagnostics sink
(dependency inversion on a `DiagnosticSink`/logger interface already available
via `provider.loggerRef` / `@ts-linq/telemetry`). Every catch must be one of the
sanctioned shapes:

- **valid recovery** — log at debug + continue (warm-up, pre-warm).
- **cleanup-with-swallow** — log at warn during dispose, never rethrow.
- **telemetry-with-rethrow / log-and-continue** — invalidation/metrics: log at
  warn; for post-commit invalidation, surface a typed warning so callers can
  detect potential staleness.

No empty `catch {}` and no commented-out logging may remain.

## Proposed refactor

1. Reinstate a real internal logging call (route through `provider.loggerRef` or
   a small `internalDiag(label, error)` helper) and delete the commented lines.
2. Reclassify each catch per the list above; convert silent swallows to
   log-and-continue with the operation label already present in the dead comments
   (e.g. `'DbContext.commitTransaction.invalidateCaches'`).
3. For post-commit invalidation failure, emit a structured warning event so the
   staleness is observable (consider exposing via the diagnostics options).
4. Replace `DbSet.invalidateCountCache`'s `catch {}` with a logged catch.
5. Add `cause` preservation where errors are re-wrapped (ties into task-5).

## Suggested design patterns

- **Strategy / dependency inversion** on a `DiagnosticSink` interface so error
  reporting is injectable and testable (no global logger).
- **Null Object** for the sink when diagnostics are disabled (keeps call sites
  branch-free).

## Testing plan

- **Error-path unit tests:** force `cacheCoordinator.invalidateOnCommit()` to
  throw and assert (a) commit still completes, (b) a diagnostic is emitted.
- Same for `reportMetrics`, `warmUp` task rejection, `dispose` profiler stop, and
  `DbSet.invalidateCountCache`.
- Assert no empty `catch {}` remains (lint rule / grep gate in CI).

## Acceptance criteria

- [ ] No commented-out `// logInternalError` lines remain in `DbContext.ts`.
- [ ] Every catch listed above logs through an injectable sink with its label.
- [ ] Post-commit invalidation failure is observable (typed warning/event).
- [ ] `DbSet.invalidateCountCache` no longer swallows silently.
- [ ] Error-path tests cover each reclassified catch.
- [ ] `pnpm lint` passes with an enforced no-empty-catch rule.

## Refactor order

1. Add `DiagnosticSink` abstraction + Null Object.
2. Reclassify catches one method at a time with a test each.
3. Add CI grep/lint gate against empty catches and commented loggers.

## Notes

This is independent of task-1 but should land before or together with it, since
task-1 moves several of these methods into new classes; fixing the catches first
keeps the move mechanical.

## Implementation note (completed)

Implemented on branch `audit-refactor/orm-fix-silent-catches`.

- **Seam:** new internal `DiagnosticSink` (`src/context/DiagnosticSink.ts`) with a
  `NULL_DIAGNOSTIC_SINK` Null Object, a logger-backed default routing through the
  existing `provider.loggerRef` (`SqlLogger`), and `createDiagnosticSink(logger)`.
  Built once in `DbContextBootstrapper` and carried on `DbContextServices`.
- **The 7 cited sites** were reclassified per the table (debug recovery / warn
  cleanup / observable staleness). Post-commit invalidation failure now emits an
  **observable structured staleness warning** (`{ staleCache: true }`) via
  `cacheStaleAfterCommit`.
- **Scope expanded to a full `orm/src` sweep** (user-approved): the original 7
  sites were not the only silent swallows. Critically, `CacheCoordinator`
  (`src/services/CacheCoordinator.ts`) had **9** `catch { /* ignore */ }` blocks —
  and `invalidateOnCommit()` self-swallowed, so without fixing it the new
  staleness warning would have been dead code (the throw never reached
  `TransactionScope`). `invalidateOnCommit()` now propagates; the remaining 8 log
  via the sink. Four further pre-existing swallows were reclassified:
  `ChangeValidationService.runConditionalValidations` (sink-injected),
  `DbContextTransaction.asyncDispose` rollback + `PendingModelChangesChecker
  .loadMigrationClass` (sink built from `provider.loggerRef`), and the
  `GraphIterator` thunk-vs-ctor **capability probe** (restructured to a non-empty,
  documented catch — no logger, it is expected control flow).
- **CI gate:** new `packages/orm/eslint.config.mjs` adds a scoped
  `no-restricted-syntax` rule banning empty catch in `src/**`, plus a
  `tests-new/NoEmptyCatch.test.ts` grep gate (also forbids commented
  `logInternalError`).
- **Coordination with task-5:** the reclassified catches log-and-continue; where
  task-5 later wraps/rethrows, it should adopt typed `OrmError` subclasses. No
  parallel hierarchy introduced here.
- **Validation:** typecheck, lint (empty-catch rule enforced, 0 errors), unit
  3683, integration 457 (one MSSQL-spatial container flake re-confirmed passing in
  isolation), e2e 290, build, arch deps/cycles/dead — all green.
- **Changeset:** `@ts-linq/orm` patch (behavioural fix; sink internal, public API
  unchanged).
