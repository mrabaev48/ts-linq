# refactor orm/task-2: Fix silent/commented-out catches — ✅ DONE

**Status:** completed. orm's 2ND refactor task (after task-1 decompose). Branch
`audit-refactor/orm-fix-silent-catches` from main. `@ts-linq/orm` **patch 4.1.13 → 4.1.14**
(behavioural fix; sink internal, public API byte-identical). orm stays 🔄 In Progress; next orm = task-3.

## The seam: DiagnosticSink (DIP + Null Object + single internalDiag)
New internal `packages/orm/src/context/DiagnosticSink.ts` (NOT barrel-exported):
- `interface DiagnosticSink { internalDiag(label, error, level?: 'debug'|'warn'): void; cacheStaleAfterCommit(label, error): void; }`
- `NULL_DIAGNOSTIC_SINK` Null Object (no-ops) → branch-free call sites.
- private `LoggerDiagnosticSink` routes through existing `provider.loggerRef` (`SqlLogger.debug/warn`);
  `cacheStaleAfterCommit` → `logger.warn(..., { label, staleCache: true, error })` = **observable structured staleness event** (NO public `SqlLogger` change → patch, not minor).
- `createDiagnosticSink(logger)` → Null Object when no logger. `describe(error)` reduces to safe `{name,message}`.
- core's `logInternalError` is NOT exported from core barrel → orm needed its own seam (query did the same).

## Wiring
- `DbContextServices` gained `readonly diagnosticSink`. Built once in `DbContextBootstrapper.bootstrap` AFTER `attachLogger`, from `provider.loggerRef`. Passed into `CacheCoordinator` (new 8th ctor arg, default NULL) + `ChangeValidationService` (new 3rd ctor arg, default NULL).
- `TransactionScope` Pick widened with `'diagnosticSink'`. `DbContext` facade got private `get _diagnosticSink()`. `DbSet` threads it via `DbSetContext.diagnosticSink` (set in `DbSetRegistry.buildDbSetContext`), stored as `_diagnosticSink = ctx.diagnosticSink ?? NULL_DIAGNOSTIC_SINK`.

## Scope EXPANDED to full orm/src sweep (user-approved)
The 7 cited sites were NOT the only silent swallows; the lint gate surfaced 14 more. Key insight:
**`CacheCoordinator.invalidateOnCommit()` self-swallowed**, so the staleness throw never reached
`TransactionScope.commit` — the new warning would have been DEAD CODE. Fix: `invalidateOnCommit()` now
**propagates** (thin `if(entityCache) entityCache.clear()`); its 8 sibling swallows log via sink.
Reclassified per behaviour:
- TransactionScope.commit invalidation → `cacheStaleAfterCommit` (observable staleness, warn).
- TransactionScope.rollback entity-cache readout → internalDiag (warn).
- DbContext.cache.warmUp.task → internalDiag debug (best-effort recovery).
- DbContext.cache.reportMetrics → internalDiag warn.
- DbContext.dispose.memoryProfiler.stop → internalDiag warn (cleanup-with-swallow).
- DbContext.ensureCreated.instantiate (`catch {}`) → internalDiag debug, keep continue.
- DbSet.invalidateCountCache (`catch {}`) → internalDiag warn.
- CacheCoordinator ×9 (invalidateAfterMutation/clearAll×2/invalidateByEntityNames×2/computeNeedFullL2Clear/removeDeletedFromEntityCache/invalidateSqlCacheByNames/invalidateCountCacheByNames) → internalDiag; invalidateOnCommit propagates.
- ChangeValidationService.runConditionalValidations → internalDiag (sink-injected).
- DbContextTransaction.asyncDispose rollback + PendingModelChangesChecker.loadMigrationClass → `createDiagnosticSink(this._provider.loggerRef).internalDiag(...)` inline.
- GraphIterator thunk-vs-ctor **capability probe** → restructured to non-empty documented catch (`return targetEntity` inside catch); NO logger — it's expected control flow, not an error.

## CI gate
- NEW `packages/orm/eslint.config.mjs` (mirrors migrations precedent) + `tsconfig.eslint.json`.
  Base config sets `no-empty: off`; we add scoped `no-restricted-syntax` selector
  `CatchClause[body.body.length=0]` for `src/**/*.ts` (also flags comment-only catch). Verified it fires.
- NEW `tests-new/NoEmptyCatch.test.ts` grep gate (empty catch + commented `logInternalError`).
- Local eslint config widened lint coverage of orm test files → warnings 226→258 (all pre-existing `any`, benign).

## Tests
- `tests-new/context/DiagnosticSink.test.ts` (6) — routing/NullObject/factory.
- `tests-new/SilentCatchDiagnostics.test.ts` (7) — each site via capturing logger (`provider.attachLogger(logger)` BEFORE ctor so bootstrap builds sink from it) + **end-to-end** real-CacheCoordinator commit staleness (entityCache.clear throws → warning).
- `tests-new/NoEmptyCatch.test.ts` (3).
- Existing TransactionScope.test mocks pass unchanged (catch not entered on happy path).

## Validation (all green)
typecheck, lint (gate enforced, 0 err), unit 3683, integration 457 (1 MSSQL-spatial container flake re-confirmed passing isolated), e2e 290, build, arch deps/cycles/dead.

## Coordination / follow-ups
- task-5 (typed errors): reclassified catches log-and-continue; where task-5 wraps/rethrows it should adopt typed OrmError subclasses. No parallel hierarchy here.
- DbContextTransaction/PendingModelChangesChecker build a sink per error-invocation (cheap, error-only path) instead of holding a field — avoids param-property init-order pitfalls.
