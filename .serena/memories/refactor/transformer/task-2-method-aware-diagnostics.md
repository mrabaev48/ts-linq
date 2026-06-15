# refactor/transformer/task-2 — method-aware makeUnsupported diagnostics

✅ DONE — transformer's 3RD refactor task (order: task-4 → task-3 → **task-2** → task-1 remaining).

## What changed
`makeUnsupported` in `packages/transformer/src/nodes/builders.ts` no longer hardcodes
`where()`. Signature changed from `(node, sink?: DiagnosticSink)` →
`(node, ctx?: { sink?: DiagnosticSink; methodName?: string })`. Message is now
`${methodName}() predicate contains unsupported expression: ...` (interpolated from
`TransformContext.methodName`), with a generic `predicate contains unsupported expression: ...`
fallback when no methodName supplied. `SUPPORTED_SUMMARY` text and DiagnosticSink-optional
behaviour preserved. With `methodName:'where'` the message is byte-identical to the old one
(regression-safe).

A structural `{ sink, methodName }` object (NOT the whole `TransformContext`) is passed so the
leaf `nodes/` module stays decoupled from `expression/TransformContext` (correct dependency
direction).

## Call sites (13 total, all carry a tctx)
- **Group A (11)** — already passed `tctx.sink`, now pass `{ sink: tctx.sink, methodName:
  tctx.methodName }`: ExpressionDispatcher, transformExpression (×2), PrefixUnaryVisitor,
  PropertyAccessVisitor, CallVisitor (×6).
- **Group B (2)** — `BinaryVisitor` and `IdentifierVisitor` emit their OWN method-aware
  `reportDiagnostic` first, then call `makeUnsupported`. They pass `{ methodName }` ONLY (no
  sink) → sentinel `description` is method-accurate without DOUBLE-emitting a diagnostic.
  IMPORTANT gotcha: do not add `sink` here or you get duplicate diagnostics.

## Which methods actually flow through makeUnsupported
- `where` / `having` → `WhereHavingRewriter` (methodName = `expr.name.text`).
- `hasQueryFilter` → `HasQueryFilterRewriter` (methodName = `'hasQueryFilter'`).
- `select` does **NOT** route through `makeUnsupported` — `SelectRewriter` builds fields
  directly and emits its own diagnostics already hardcoded to `select()` (correct, single-method
  rewriter). So a "select() via makeUnsupported" test is not reachable; not a gap.

## Tests (tests-new/WhereTransformer.test.ts)
Added: having() ternary → message starts `having()`; hasQueryFilter() ternary → starts
`hasQueryFilter()`; where() ternary regression → still `where()`. A ternary `?:` body is the
simplest expression that reaches ExpressionDispatcher's no-handler → makeUnsupported path.

## Public API / changeset
`makeUnsupported` is internal (only `src/index.ts` `tsLinqTransformer` default +
`EFCompileQueryVisitorVersion` type are public; nothing outside transformer imports it). No
runtime/public API change → **no changeset** (per CLAUDE.md §14, compile-time diagnostic text
only).

## Validation — ALL GREEN
typecheck, lint (0 errors), test:unit (3410), test:integration (461), test:e2e (290), build (32),
arch:deps (no violations), arch:cycles (none), arch:dead (clean).

## Coordination
Pairs with **task-1** (CallVisitor split) — task-1 will touch the same CallVisitor call sites, so
expect a small rebase/merge overlap there. transformer package now: task-4, task-3, task-2 ✅;
task-1 pending. Next transformer = task-1.
