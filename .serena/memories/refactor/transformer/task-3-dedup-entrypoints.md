# refactor transformer/task-3: de-duplicate entrypoints + receiver-patch (DONE)

**Status:** ✅ DONE — transformer's 2ND task. Package now 🔄 In Progress (tasks 4, 3 ✅;
tasks 2, 1 pending).
**Branch:** `audit-refactor/transformer-dedup-entrypoints` (from main after PR #207).

## Problem
Two near-identical traversal copies of the same call-rewrite algorithm:
- `index.ts` default export `tsLinqTransformer` (ts-patch entrypoint) — sink via
  `extractSinkFromCtx(ctx)`.
- `WhereTransformer.ts` `createWhereTransformer` (programmatic/test entrypoint) — sink injected.
Both duplicated `TARGET_METHODS`, the dispatch ternary, and — highest-risk — the hand-written
chained-receiver re-rewrite block (manual `updatePropertyAccessExpression` +
`updateCallExpression` with `as ts.PropertyAccessExpression` cast). Only material diff = sink
acquisition.

## Solution (Extract Method / Template Method + Dispatch table)
New shared module `packages/transformer/src/CallRewriteVisitor.ts` exports
`buildVisitor(ctx, checker, sink)` returning the `(node)=>ts.Node` visitor. It owns:
- `DISPATCH: ReadonlyMap<string, RewriterFn>` (`where|having→rewriteCall`,
  `select→rewriteSelectCall`, `hasQueryFilter→rewriteHasQueryFilterCall`) — mirrors
  `ExpressionDispatcher.DISPATCH_MAP`. **`TARGET_METHODS` eliminated entirely**: the map keys
  ARE the target-method set (`DISPATCH.get(name) !== undefined`) — single source of truth for
  both "which methods" AND "which rewriter".
- `rewriteWithVisitedReceiver(rewritten, originalReceiver, visit)` — the SINGLE implementation
  of the fragile receiver-patch; the only `as ts.PropertyAccessExpression` downcast lives here
  (two prior copies collapsed to one local var + one cast expression). No new casts.
- `RewriterFn`/`DISPATCH`/`rewriteWithVisitedReceiver` are module-private; only `buildVisitor`
  is exported.

Both entrypoints are now thin adapters — each does its `isDeclarationFile` guard, obtains the
sink (ctx vs injected), then
`return ts.visitEachChild(sourceFile, buildVisitor(ctx, checker, sink), ctx)`. They differ in
exactly one line (sink acquisition). All three rewriters share signature
`(call, checker, ctx, sink: DiagnosticSink|undefined) => ts.CallExpression|null` (RF-01 +
task-4 already threaded sink, so no rewriter changes needed).

## Tests
New `tests-new/EntrypointParity.test.ts` (own compile harness, query shim):
- Unit: `buildVisitor` directly drives `.where().where()` receiver-patch → 2× whereCompiled.
- Contract: same source through `tsLinqTransformer(program,{})` (sink undefined) vs
  `createWhereTransformer(program,{addDiagnostic:noop})`, printed via `ts.createPrinter`,
  asserted byte-for-byte equal (`toBe`) over 4 cases (single where / chained / select / having).
Existing `WhereTransformer.test.ts` (incl. chained describe) untouched & green — now exercises
`buildVisitor` via the adapter.

## Coordination
Centralizes the dispatch that **task-1** (CallVisitor split) and **task-2** (method-accurate
diagnostics) also touch — they now edit one place (`CallRewriteVisitor`). The remaining
`as ts.PropertyAccessExpression` downcast in `rewriteWithVisitedReceiver` is the single such
cast, comment-marked (separate from the only `as unknown as` cast at `DiagnosticSink.ts:43`).

## Changeset
**patch** `@ts-linq/transformer` 2.1.23 → **2.1.24**. NOTE: semantically a no-op (identical
AST output, compile-time-only) but the CI `Version bump present` check requires a bump whenever
versioned package `src/` changes — so patch is mandatory, not optional. Consumed locally.

## Validation (all green)
typecheck 32/32, lint 0 errors (27 pre-existing warnings, none in new files), unit 3407/3407
(+5 new), integration 461 pass/2 skip, e2e 290/290 (temporal.e2e flaked once under parallel
MSSQL startup, passed in isolation + on full re-run), build, arch:deps/cycles/dead clean.
