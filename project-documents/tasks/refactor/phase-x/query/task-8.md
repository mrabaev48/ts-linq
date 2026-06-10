---
status: completed
phase: phase-x
package: query
priority: P1
effort: M
risk: medium
category: error-handling
depends_on: []
related: ["query/task-9.md"]
---

# Refactor: Classify and fix silent/over-broad catch blocks in the query execution path

## Problem
The query package contains several `catch` blocks that silently swallow errors in
core paths. Per the audit's classification model, each is categorized below; the **invalid**
ones become fixes.

### Catch inventory (with classification)
1. `GlobalFilterApplier.ts:64` — `catch {}` swallowing `visitor.toSql` failures when
   compiling a per-context query filter.
   **Classification: INVALID SILENT SWALLOW.** A filter that fails to compile is *dropped*,
   so a security-relevant global filter (e.g. tenant isolation, soft-delete) can silently
   vanish, returning rows it should hide. This is the most dangerous swallow in the package.
2. `QueryExecutor.ts:177` — `catch {}` around `populateIncludes` during fallback.
   **Classification: borderline — translation/degradation.** Acceptable *intent* (best-effort
   includes on stale fallback data) but should at least log via `logInternalError`.
3. `QueryExecutor.ts:261, 298, 480` — `catch { continue }` / `catch { return null }` in the
   hedging/race paths. **Classification: degradation, but lossy.** Errors from every fallback
   source are discarded with no aggregate signal; a totally-failing fallback set is
   indistinguishable from "no fallback configured."
4. `RowMaterializer.ts:156, 167` — `catch { /* ignore */ }` around `cacheSize`/
   `notifyEntityMaterialized` telemetry. **Classification: VALID telemetry-with-ignore**
   (must never break materialization). Keep, but route through `logInternalError` for parity.
5. `SetPropertyCalls.ts:45` — `catch {}` around the selector `Proxy` call.
   **Classification: borderline.** Swallows proxy errors then relies on the `accessed`
   array; if the lambda threw *before* any access, the generic "could not extract" error
   fires — acceptable but the original cause is lost.
6. `includeUtils.ts:18` — `catch {}` around forward-ref ctor resolution.
   **Classification: VALID** (forward-ref factories legitimately throw); fine to treat as
   "unresolvable" — but `IncludePlanner` later throws `UNRESOLVABLE_TARGET` which is the
   right surfacing.
7. `Queryable.ts:1049` — `catch { re-run to surface error }` in the include proxy.
   **Classification: VALID translation** (deliberately re-invokes to throw the real error),
   though the double-invocation is a smell (side effects run twice).

## Evidence
- File:line references above, all verified against current source.
- `InternalLogger.logInternalError` already exists (`InternalLogger.ts:5`) and is used in
  `QueryExecutor` hedging (`:288, 446, 475`) but **not** in the swallows at `:177, 261, 298,
  480` nor in `GlobalFilterApplier`/`RowMaterializer`.

## Why this is bad
- **#1 is a correctness/security defect**: a dropped query filter can leak data.
- Inconsistent logging: some catches log via `logInternalError`, peers swallow — no uniform
  observability into degraded execution.
- Re-running the include lambda (#7) executes user side effects twice.

## Target architecture
Adopt a consistent **error-handling policy** (Clean Code error handling):
- **Never swallow in a path that affects result correctness** (filters, predicates).
- **Degradation paths log** (telemetry-with-rethrow or telemetry-with-ignore via
  `logInternalError`) and surface an aggregate cause when *all* fallbacks fail.
- **Telemetry catches** are explicitly the only "ignore" category, all routed through one
  logger.

## Proposed refactor
1. `GlobalFilterApplier`: do **not** swallow. A filter that fails to compile must throw a
   typed `QueryFilterCompilationError` (fail-closed), or at minimum log + re-throw — never
   silently produce an under-filtered query.
2. `QueryExecutor` race/fallback catches: collect errors and, when every source fails,
   throw an `AggregateError`-like wrapper (preserve the primary error as `cause`).
3. Route `:177` and `RowMaterializer` telemetry catches through `logInternalError`.
4. `Queryable` include proxy (#7): capture the thrown error on first invocation and rethrow
   it directly instead of re-running the lambda (avoid double side effects) — see
   `query/task-9.md` for the proxy design.

## Suggested design patterns
- **Fail-closed for security-relevant filters** — *Why*: never widen a result set on error.
- **Error aggregation / `cause` chaining** — *Why*: distinguishable, debuggable degradation.
- **Single logging seam** (`logInternalError`) — *Why*: uniform observability.

## Testing plan
- **Error-path unit**: filter that produces an invalid AST → throws (not silently dropped).
- **Error-path unit**: all fallbacks fail → aggregate error with original cause.
- **Regression**: telemetry failure does not break materialization.
- **Unit**: include proxy throws once, lambda invoked once.

## Acceptance criteria
- [ ] `GlobalFilterApplier` no longer silently drops filters (fail-closed or log+rethrow).
- [ ] Fallback exhaustion surfaces an aggregate error preserving the primary cause.
- [ ] All "ignore" telemetry catches routed through `logInternalError`.
- [ ] Include proxy no longer double-invokes the user lambda.
- [ ] Error-path tests added for each.

## Refactor order
Do the `GlobalFilterApplier` fix first (correctness/security). Proxy fix pairs with
`query/task-9.md`.

## Notes
The filter-swallow fix changes behavior (errors now surface) — `minor`/`patch` changeset
with a clear note; argue it is a security fix.
