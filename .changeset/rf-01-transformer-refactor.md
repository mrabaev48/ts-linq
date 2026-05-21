---
'@ts-linq/transformer': patch
---

refactor(RF-01): clean architecture for transformer — dispatch map, DiagnosticSink, visitor split

Internal refactor with no public API surface change:
- `DiagnosticSink` interface + `extractSinkFromCtx` consolidated in `diagnostics/DiagnosticSink.ts` — single `as unknown as` cast in the entire package
- `ExpressionNode` discriminated union restored in `nodes/ExpressionNode.ts`
- Expression dispatch rewritten as `DISPATCH_MAP: Partial<Record<ts.SyntaxKind, VisitorFn>>` in `ExpressionDispatcher.ts`
- Each visitor extracted to its own file under `expression/visitors/`
- `TransformContext` gains `recurse` field to break the dispatcher→visitor→dispatcher circular import
- `WhereHavingRewriter` and `SelectRewriter` moved to `rewriters/`
- `receiverIsQueryable` guard moved to `scope/QueryableGuard.ts`
- `src/index.ts` trimmed to ≤40 lines (factory only)
- `src/WhereTransformer.ts` no longer uses `Object.assign` on `TransformationContext`
- Old `src/expression.ts` and `src/utils.ts` deleted
- 71 new unit tests added under `tests-new/unit/`
