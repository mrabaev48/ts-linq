---
status: completed
phase: phase-x
package: transformer
priority: P1
effort: M
risk: medium
category: architecture
depends_on: []
related: []
---

# Refactor: De-duplicate the two transformer entrypoints and the fragile receiver-rewrite logic

## Problem
The package has **two near-identical traversal implementations** of the same call-rewriting
algorithm:

- `index.ts` default export `tsLinqTransformer` (the ts-patch entrypoint), lines 28-70.
- `WhereTransformer.ts` `createWhereTransformer` (the programmatic/test entrypoint),
  lines 23-62.

Both define the same `TARGET_METHODS` set (`index.ts:19`, `WhereTransformer.ts:8`), the same
`select`/`hasQueryFilter`/else dispatch (`index.ts:36-41`, `WhereTransformer.ts:30-35`), and
— most concerningly — the **same fragile, hand-written receiver re-rewriting block** that
manually reconstructs the `PropertyAccessExpression` and `CallExpression` to re-visit a
chained receiver (`index.ts:42-63`, `WhereTransformer.ts:36-55`), including the same
`as ts.PropertyAccessExpression` casts.

## Evidence
- `TARGET_METHODS` duplicated: `index.ts:19` and `WhereTransformer.ts:8`.
- Dispatch ternary duplicated: `index.ts:36-41` and `WhereTransformer.ts:30-35`.
- Receiver-patch block duplicated verbatim (modulo a comment): `index.ts:42-63` vs
  `WhereTransformer.ts:36-55`.
- The only material difference: `index.ts` resolves the sink via `extractSinkFromCtx(ctx)`
  (`index.ts:30`), while `WhereTransformer` takes the sink as a constructor argument.

## Why this is bad
- **DRY**: two copies of a subtle AST-surgery algorithm will drift; a bug fixed in one is
  missed in the other.
- **Fragility/maintainability**: the manual `updatePropertyAccessExpression` +
  `updateCallExpression` receiver patch (with casts) is the most error-prone code in the
  package; duplicating it doubles the risk.
- **Two sources of truth** for "which methods are rewritten" and "how chained calls recurse."

## Target architecture
Extract a single `createCallRewriteVisitor(checker, sinkResolver)` that owns:
- the `TARGET_METHODS` set,
- the method→rewriter dispatch (could itself be a small map: `where|having→rewriteCall`,
  `select→rewriteSelectCall`, `hasQueryFilter→rewriteHasQueryFilterCall`),
- the chained-receiver re-rewrite logic (one implementation),
and have **both** entrypoints (`index.ts` default export and `createWhereTransformer`) call
it, differing only in how they obtain the `DiagnosticSink` (from ctx vs injected).

## Proposed refactor
1. Extract `buildVisitor(ctx, checker, sink)` returning the `(node) => ts.Node` visitor.
2. Replace the dispatch ternary with a `Map<string, RewriterFn>`.
3. Encapsulate the receiver-patch in one helper `rewriteWithVisitedReceiver(rewritten,
   originalReceiver, visit)`.
4. `index.ts` calls `buildVisitor` after `extractSinkFromCtx`; `createWhereTransformer` calls
   it with the injected sink.

## Suggested design patterns
- **Extract Method / Template Method** — *Why*: one canonical traversal; entrypoints become
  thin adapters differing only in sink acquisition.
- **Dispatch table (Map)** — *Why*: consistent with `ExpressionDispatcher.DISPATCH_MAP`;
  removes the nested ternary.

## Testing plan
- **Unit**: `buildVisitor` rewrites chained `.where().where()` correctly (the receiver-patch
  path) — the behavior currently duplicated.
- **Regression**: `WhereTransformer.test.ts` green; ts-patch e2e (if any) unaffected.
- **Contract**: both entrypoints produce identical output for the same input.

## Acceptance criteria
- [ ] Single shared visitor/dispatch implementation.
- [ ] `TARGET_METHODS` and the receiver-patch logic exist in exactly one place.
- [ ] Both entrypoints delegate to it.
- [ ] Chained-call regression test added.
- [ ] Existing tests green.

## Refactor order
Independent; do before `transformer/task-1.md`/`task-2.md` if convenient (it touches the
dispatch the others also touch).

## Notes
Compile-time-only; no runtime API change. The receiver-patch deduplication is the real
maintainability win — that block is the package's highest-risk code.
