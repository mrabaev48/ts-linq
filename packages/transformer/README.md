# @ts-linq/transformer

> TypeScript compiler transformer that rewrites LINQ-style lambda expressions into ts-linq AST
> nodes at build time.

ts-linq lets you write strongly typed predicates like `where(u => u.age > 18)`. This transformer
plugs into the TypeScript compilation pipeline and converts those arrow-function bodies into
serializable `@ts-linq/ast` nodes, so the query engine can translate them to SQL without parsing
JavaScript source at runtime.

## Installation

```bash
pnpm add -D @ts-linq/transformer typescript
```

Wire it into your build (e.g. via `ts-patch` / `ttypescript` / a bundler TS plugin) as a
`before` transformer.

## What lives here

- **`tsLinqTransformer`** (default export) — the TypeScript `TransformerFactory`.
- **Expression pipeline** — `transformExpression`, `ExpressionDispatcher`, `TransformContext`.
- **Rewriters** — `WhereHavingRewriter`, `SelectRewriter`, `HasQueryFilterRewriter`.
- **Scope guards** — `QueryableGuard`, `EntityTypeBuilderGuard` (only rewrite lambdas in the right
  call positions).
- **Diagnostics** — `DiagnosticSink` for surfacing transform-time problems.
- **Node builders** — helpers that emit AST node literals.

## Usage

```jsonc
// tsconfig.json (with ts-patch / ttypescript)
{
  "compilerOptions": {
    "plugins": [{ "transform": "@ts-linq/transformer" }]
  }
}
```

## Package structure

```
src/
  index.ts                       # tsLinqTransformer (default export)
  expression/transformExpression.ts, ExpressionDispatcher.ts, TransformContext.ts
  rewriters/                     # where/having/select/query-filter rewriters
  scope/                         # call-site guards
  diagnostics/DiagnosticSink.ts
  nodes/                         # AST node literal builders
  visitors/EFCompileQueryVisitor.ts
```

## Dependencies

- `@ts-linq/ast`, `@ts-linq/types`
- `typescript` (peer)

## License

Part of the ts-linq monorepo. See the repository root for license details.
