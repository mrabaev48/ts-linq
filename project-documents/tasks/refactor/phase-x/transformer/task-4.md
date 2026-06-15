---
status: completed
phase: phase-x
package: transformer
priority: P1
effort: S
risk: medium
category: error-handling
depends_on: []
related: []
---

# Refactor: Stop silently swallowing TypeChecker failures in the scope guards

## Problem
The two scope guards that decide whether a call should be rewritten both wrap the
`TypeChecker` calls in a bare `catch { return false }`:

- `QueryableGuard.receiverIsQueryable` (`scope/QueryableGuard.ts:5-13`):
  ```ts
  try {
    const type = checker.getTypeAtLocation(receiver);
    const props = checker.getPropertiesOfType(type);
    return props.some((p) => p.getName() === BRAND);
  } catch {
    return false;
  }
  ```
- `EntityTypeBuilderGuard.receiverIsEntityTypeBuilder` (`scope/EntityTypeBuilderGuard.ts:5-16`)
  — identical pattern.

When the checker throws (e.g. an incomplete type graph, a checker edge case), the guard
returns `false`, so `rewriteCall`/`rewriteSelectCall`/`rewriteHasQueryFilterCall`
**silently skip the rewrite** (`WhereHavingRewriter.ts:21`, `SelectRewriter.ts:18`). The
`.where(...)` call is then left as the **runtime stub**, which throws at runtime:
`"ts-linq(where): compile-time transformer is required..."` (`Queryable.ts:630`).

**Classification: INVALID SILENT SWALLOW** — a recoverable-looking `false` converts a
compile-time concern into a confusing *runtime* failure, with no diagnostic telling the
developer the transformer skipped their query.

## Evidence
- `QueryableGuard.ts:10` and `EntityTypeBuilderGuard.ts:13` — `catch { return false }`.
- The runtime stub that fires when a rewrite is skipped: `Queryable.ts:627-633`.
- No `reportDiagnostic` / logging on the catch path (contrast: the rest of the package emits
  diagnostics via `DiagnosticSink`).

## Why this is bad
- **Misdiagnosed failure mode**: a checker hiccup surfaces as a runtime "configure the
  transformer" error, sending developers to fix configuration that is actually fine.
- **Invisible**: no warning diagnostic is emitted, so the skip is undetectable at build time.
- **Two copies** of the same swallow (DRY + consistency).

## Target architecture
Distinguish "receiver is provably not a Queryable" (legitimate `false`, no rewrite) from
"checker failed to determine the type" (should emit a **warning diagnostic** so the developer
knows a query was left un-rewritten). Apply a consistent guard error policy.

## Proposed refactor
1. Extract a shared `hasTypeBrand(checker, receiver, brand, sink?)` helper used by both
   guards (DRY).
2. On a caught checker error, emit a `DiagnosticCategory.Warning` via the existing
   `reportDiagnostic` (the guards would need the sink threaded in) — message: "Could not
   resolve the receiver type for `<method>`; the query was left un-rewritten and will throw
   at runtime."
3. Still return `false` (don't crash the compile), but make the skip **observable**.

## Suggested design patterns
- **Fail-visible** — *Why*: a swallowed skip that defers to a runtime throw is the worst
  outcome; surface it at build time.
- **Extract Function / DRY** — *Why*: one branded-type check for both guards.

## Testing plan
- **Error-path unit**: a receiver whose checker call throws → guard returns `false` **and**
  a warning diagnostic is recorded in the sink.
- **Unit**: a genuine non-Queryable receiver → `false`, **no** diagnostic (not every
  non-match should warn — distinguish "not branded" from "checker threw").
- **Regression**: existing scope/rewriter tests green.

## Acceptance criteria
- [ ] Both guards share one branded-type helper.
- [ ] Checker-failure path emits a warning diagnostic (skip is observable).
- [ ] Genuine non-matches do not warn.
- [ ] Error-path test added.
- [ ] Existing tests green.

## Refactor order
Independent; pairs with `transformer/task-3.md` (both touch the rewrite entry path / sink
threading).

## Notes
The hard part is threading a `DiagnosticSink` into the guards (currently they take only
`checker` + `receiver`). `transformer/task-3.md`'s shared visitor already has the sink in
scope, so doing these together is efficient. Compile-time-only; no runtime API change.
