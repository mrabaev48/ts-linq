# refactor transformer/task-4: visible TypeChecker failures in scope guards (DONE)

**Status:** ✅ DONE — transformer's FIRST task (package now 🔄 In Progress; tasks 3, 2, 1 pending).
**Branch:** `audit-refactor/transformer-visible-checker-failures`.

## Problem
Both scope guards (`scope/QueryableGuard.receiverIsQueryable`,
`scope/EntityTypeBuilderGuard.receiverIsEntityTypeBuilder`) wrapped `TypeChecker` calls in a
bare `catch { return false }`. When the checker threw, the rewrite was silently skipped, the
`.where(...)` call stayed as the runtime stub, and at runtime it threw the misleading
"compile-time transformer is required" error (`packages/query/.../Queryable.ts:~630`) —
sending devs to fix config that was actually fine.

## Solution (Extract Function / DRY + Fail-visible)
- New shared helper `packages/transformer/src/scope/hasTypeBrand.ts`:
  `hasTypeBrand(checker, receiver, brand, methodName, sink?)`. Unbranded receiver →
  `false`, NO diagnostic (legit non-match). Only a **thrown** checker call emits a
  `ts.DiagnosticCategory.Warning` via existing `reportDiagnostic` (sink), then still returns
  `false` so the compile doesn't crash. Diagnostic node = `receiver`. Uses VALUE import
  `import * as ts` (needs `ts.DiagnosticCategory`); guards keep `import type * as ts`.
- Both guards now delegate to `hasTypeBrand` and take `(checker, receiver, methodName, sink?)`.
  BRAND constants stay private in each guard file, passed as `brand` arg.
- 3 call sites updated to thread `methodName` + `sink` (the only callers, confirmed via
  find_referencing_symbols):
  - `WhereHavingRewriter.ts` → `receiverIsQueryable(checker, receiver, methodName, sink)`
  - `SelectRewriter.ts` → `receiverIsQueryable(checker, receiver, 'select', sink)`
  - `HasQueryFilterRewriter.ts` → `receiverIsEntityTypeBuilder(checker, receiver, 'hasQueryFilter', sink)`

## Key finding: task-3 NOT a blocker
The `DiagnosticSink | undefined` sink was ALREADY threaded into all three rewriters by RF-01,
and `methodName` is available at every call site. So the "hard part" (threading the sink) was
already done — only needed to pass it one level deeper. This establishes the guard-level sink
path that `transformer/task-3` (entrypoint de-dup) can rely on; simplifies/coordinates with it.

## Tests
New `tests-new/unit/scope/hasTypeBrand.test.ts` (8 tests): throwing checker → false + exactly
one Warning diagnostic (code TS_LINQ_DIAGNOSTIC_CODE, message contains methodName); non-branded
→ false no diag; branded → true no diag; undefined sink → stderr fallback, no crash; both guard
delegations. Fake checker built directly (getTypeAtLocation throws / returns props), no full
program needed. Existing rewriter/transformer tests unchanged & green.

## Validation (all green)
typecheck 32/32, lint 0 errors (27 pre-existing warnings, none in new files), unit 3402/3402,
integration 461 pass/2 skip, e2e 290/290, build, arch:deps/cycles/dead all clean.

## Changeset
`patch` for @ts-linq/transformer → 2.1.22 → **2.1.23** (build-time warning added; no runtime
API change). Consumed locally (`pnpm changeset version`), CHANGELOG updated.

## Follow-up / tech debt
No other guard/scope checks swallow without a diagnostic (only these two existed). The pre-
existing lint warnings (`_depth`/`_tctx` unused, CallVisitor complexity, prefer-const tctx) are
addressed by other transformer tasks (task-1/task-2), not this one.
