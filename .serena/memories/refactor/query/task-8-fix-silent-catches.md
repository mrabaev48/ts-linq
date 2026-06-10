# query/task-8 — Fix silent/over-broad catch blocks (✅ completed)

Branch `audit-refactor/query-fix-silent-catches` (from main), PR #197. Error-handling audit fix across `@ts-linq/query` (7 catch sites classified).

## Security headline
`GlobalFilterApplier.apply` (`packages/query/src/GlobalFilterApplier.ts`) previously `catch {}`-dropped a named query filter that failed to compile → a tenant-isolation / soft-delete filter could vanish and leak rows. Now **fail-closed**: throws typed `QueryFilterCompilationError` (cause preserved, `details.filterName`).

## New typed errors (in `@ts-linq/types/errors.ts`)
- `QueryFilterCompilationError` → `OrmErrorCode.QueryFilterCompilationError` = `QUERY_FILTER_COMPILATION_ERROR`
- `FallbackExhaustedError` → `OrmErrorCode.FallbackExhausted` = `FALLBACK_EXHAUSTED`
Both extend `OrmError` (native `AggregateError` rejected per CLAUDE.md §16). Exported via the explicit named re-export in `types/src/index.ts`. **Gotcha:** `packages/types/tests/type-exports.test.ts` snapshots every runtime export — must add new names there or it fails. Coverage also in `types/src/__tests__/errors.test.ts`.

## QueryExecutor fallback aggregation
`racePrimaryWithFallback` rewritten: one shared `fallbackOutcomePromise` (`FallbackOutcome = data | exhausted | none`) consumed by both the race branch and the primary-failure catch → fallback sources invoked at most once (old code double-ran `startFallback`). Non-`data` outcome adopts a never-settling promise so it can't beat a live primary. Primary fails + every source fails → throws `FallbackExhaustedError` (primary as `cause`, per-source errors in `details.errors`); zero fallbacks configured → rethrows primary unchanged. Bare `throw new Error('hedged failed')` removed.

## Single logging seam
All remaining "ignore" telemetry/degradation catches routed through `logInternalError` (`packages/query/src/InternalLogger.ts`): `RowMaterializer` cacheSize + notifyMaterialized (still no-rethrow), QueryExecutor fallback `populateIncludes`, count-race catch (keeps `return null` — outer `executeCount` already fail-loud).

## Include proxy single-invoke
`Queryable.include()` proxy catch no longer re-runs the user lambda to "surface" the error — it rethrows the captured error → lambda runs once. Minimal fix only; the full proxy *extraction* is the separately-planned query/task-9 (task-8 only owed the no-double-invoke fix).

## Left intentionally VALID (NOT residual debt)
- `includeUtils.ts:18` forward-ref ctor catch untouched (IncludePlanner surfaces UNRESOLVABLE_TARGET).
- `SetPropertyCalls.ts` selector proxy: behaviour kept, added `{ cause }` to the generic "could not extract" Error. This site is fully correct: proxy.get never throws, so the only error-surfacing path is "selector threw before any property access" (accessed empty) — and there the cause IS preserved; when a property was accessed, no error is surfaced at all (by design). There is no lost-cause case.

## Validation
typecheck / lint(0 err) / unit 3201 / integration 461 / e2e 290 / build / arch deps+cycles+dead — all green. Versions: types 4.3.0 (minor), query 2.4.36 (patch); downstream internal-dep bumps via changeset. query package status stays 🔄 In Progress (tasks 6,3,2,1,7,5,9,10 remain). Test script names: `test:unit` / `test:integration` / `test:e2e`.
