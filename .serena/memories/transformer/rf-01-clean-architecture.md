# RF-01: Transformer Clean Architecture (done — 2026-05-22)

## New package structure

```
packages/transformer/src/
├── index.ts                          # ≤40 lines — factory only
├── WhereTransformer.ts               # createWhereTransformer — no Object.assign
├── diagnostics/
│   ├── DiagnosticSink.ts             # DiagnosticSink interface + helpers + extractSinkFromCtx
│   └── index.ts                      # re-exports
├── nodes/
│   ├── ExpressionNode.ts             # discriminated union (BinaryNode...UnsupportedNode)
│   ├── builders.ts                   # str, num, prop, makeObject, makeArray, makeUnsupported(node, sink?)
│   ├── PropertyChain.ts              # collectPropertyChain, buildPropertyNode, PropertyChain
│   └── index.ts
├── expression/
│   ├── TransformContext.ts           # interface with recurse field (breaks circular import)
│   ├── ExpressionDispatcher.ts       # DISPATCH_MAP: Partial<Record<ts.SyntaxKind, VisitorFn>>
│   ├── transformExpression.ts        # MAX_DEPTH=64, depth guard, paren unwrap
│   └── visitors/
│       ├── BinaryVisitor.ts
│       ├── CallVisitor.ts
│       ├── IdentifierVisitor.ts
│       ├── LiteralVisitor.ts
│       ├── PrefixUnaryVisitor.ts
│       └── PropertyAccessVisitor.ts
├── rewriters/
│   ├── WhereHavingRewriter.ts        # rewriteCall
│   ├── SelectRewriter.ts             # rewriteSelectCall
│   └── index.ts
├── scope/
│   └── QueryableGuard.ts             # receiverIsQueryable
└── visitors/
    └── EFCompileQueryVisitor.ts      # placeholder with TODO(P2-44)
```

## Key architectural decisions

### DiagnosticSink
- Single `as unknown as` cast is ONLY in `extractSinkFromCtx` in `diagnostics/DiagnosticSink.ts`
- `TS_LINQ_DIAGNOSTIC_CODE = 90_001`
- `reportDiagnostic(sink?: DiagnosticSink, node, message, category?)` — graceful if sink is undefined

### TransformContext.recurse
- Added `recurse: (node: ts.Expression, depth: number) => ts.Expression` to break
  `ExpressionDispatcher → visitors → transformExpression → ExpressionDispatcher` circular import
- Rewriters set `recurse` via self-referential `let tctx!; tctx = { ..., recurse: (n, d) => transformExpression(n, tctx, d) }` pattern

### Chained calls top-down traversal
- After rewriting outer call, visit ORIGINAL receiver via `ts.visitNode(originalReceiver, visit)`
- Patch the rewritten call's receiver if it changed
- Required because TypeChecker cannot type-check synthetic nodes

### makeUnsupported signature change
- OLD: `makeUnsupported(node: ts.Node, ctx: ts.TransformationContext)`
- NEW: `makeUnsupported(node: ts.Node, sink?: DiagnosticSink)`

## Deleted files
- `src/expression.ts` (content distributed to `expression/` subdirectory)
- `src/utils.ts` (content distributed to `nodes/`)

## Tests
- 71 unit tests in `tests-new/unit/` (11 test files + helpers.ts)
- Integration test suite extended with 8 new scenarios in `tests-new/WhereTransformer.test.ts`
- Type-level exhaustiveness test in `tests-new/types/ExpressionNode.type-test.ts`

## Important: dist stale files
- When deleting `src/diagnostics.ts` or similar flat files and replacing with a directory
  of the same name, `tsc --build` may not remove the old `.js` file from `dist/`
- Must run `rm -rf dist && tsc -b tsconfig.json --force` to get a clean rebuild
- Node.js `require('./diagnostics')` prefers `diagnostics.js` over `diagnostics/index.js`!
