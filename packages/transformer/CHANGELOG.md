# @ts-linq/transformer

## 2.0.4

### Patch Changes

- Updated dependencies [51516f8]
- Updated dependencies [cd77e1f]
- Updated dependencies [7745012]
- Updated dependencies [90402db]
- Updated dependencies [240059c]
- Updated dependencies [2f86a0d]
- Updated dependencies [b738384]
- Updated dependencies [6cad9cf]
- Updated dependencies [d0668cb]
  - @ts-linq/types@2.3.0
  - @ts-linq/ast@2.2.1

## 2.0.3

### Patch Changes

- [#100](https://github.com/mrabaev48/ts-linq/pull/100) [`9fe97d6`](https://github.com/mrabaev48/ts-linq/commit/9fe97d695a0bdd5adc53897e6b3d95a13ace2241) Thanks [@mrabaev48](https://github.com/mrabaev48)! - refactor(RF-01): clean architecture for transformer — dispatch map, DiagnosticSink, visitor split

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

## 2.0.2

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/ast@2.2.0
  - @ts-linq/types@2.2.0

## 2.0.1

### Patch Changes

- Updated dependencies [[`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/ast@2.1.0
  - @ts-linq/types@2.1.0

## 2.0.0

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/types@2.0.0
  - @ts-linq/ast@2.0.0
