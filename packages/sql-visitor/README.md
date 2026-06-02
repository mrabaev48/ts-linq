# @ts-linq/sql-visitor

> Visitor layer that walks the query AST (`@ts-linq/ast`) and emits SQL fragments + bound
> parameters, with dialect-specific behavior injected through resolver/translator ports.

This package is the shared SQL-generation engine. It turns AST nodes into parameterized SQL while
delegating identifier quoting, function translation, JSON-path rendering, and parameter style to
the active dialect.

## Installation

```bash
pnpm add @ts-linq/sql-visitor
```

## What lives here

- **`SqlVisitor`** + **`SqlVisitorOptions`** — the entry point that renders an AST subtree to SQL.
- **Node visitors** — `BinaryVisitor`, `LogicalVisitor`, `UnaryVisitor`, `NullVisitor`,
  `InVisitor`, `MethodVisitor`, `JsonPathVisitor`, `EfFunctionVisitor`, `HierarchyMethodVisitor`,
  `SpatialMethodVisitor`, and `FragmentJoinPlanner`.
- **Parameter handling** — `ParameterState` / `ParameterStyle` (positional `?`, `$1`, `@p0`, …).
- **Rewriters** — `JsonAccessRewriter`, `ComplexAccessRewriter`.
- **Batch / SP / tag emit helpers** — `buildQuestionMarkRows`, `calcChunkSize`, `chunkArray`,
  `CallSyntaxEmitter`, `ExecSyntaxEmitter`, `emitTagComments`.
- **Ports for dialects** — `EfFunctionTranslator`, `JsonPathTranslator`, `ColumnResolver`,
  `ConverterResolver`.

## Usage

`SqlVisitor` is normally driven by `@ts-linq/query` and the dialects rather than directly. Dialects
provide the translators/resolvers; the visitor produces `{ sql, params }`.

## Package structure

```
src/
  SqlVisitor.ts               # entry point
  ParameterStyle.ts           # parameter numbering/styles
  JsonAccessRewriter.ts
  ComplexAccessRewriter.ts
  batch-emitter.ts            # batch row helpers
  sp-call-emitter.ts          # stored-procedure call syntax
  emit-tags.ts                # query tag comments
  functions/FunctionTranslator.ts
  visitors/                   # per-node visitors
  index.ts                    # public barrel
```

## Dependencies

- `@ts-linq/ast`
- `@ts-linq/types`

## License

Part of the ts-linq monorepo. See the repository root for license details.
