# CLAUDE.md — @ts-linq/transformer

## Role

Build-time **TypeScript transformer** that rewrites LINQ-style lambdas into `@ts-linq/ast` nodes.
Runs inside `tsc` (via ts-patch/ttypescript/bundler plugin), not at runtime.

## Hard boundaries

- Depends on `@ts-linq/ast`, `@ts-linq/types`, and `typescript` (peer).
- Must **not** depend on `query`/`orm`/`core` — it produces the AST they later consume.

## Critical invariants

- **Only rewrite lambdas in sanctioned call positions** (guarded by `QueryableGuard` /
  `EntityTypeBuilderGuard`). Over-eager rewriting corrupts unrelated arrow functions.
- The emitted AST must match `@ts-linq/ast` node shapes exactly — a drift here produces runtime SQL
  errors far from the cause.
- Transform-time problems must go through `DiagnosticSink`, **not** be silently swallowed. The
  TypeChecker can fail to resolve a symbol; surface it as a diagnostic instead of dropping it.

## Public API surface & stability

- Default export `tsLinqTransformer` is the contract. `EFCompileQueryVisitorVersion` is exported
  for versioned behavior.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/transformer/`:
- `task-1` — de-duplicate transformer entrypoints.
- `task-4` — stop swallowing TypeChecker failures; route through diagnostics.

## Validation

```bash
pnpm --filter @ts-linq/transformer typecheck
pnpm --filter @ts-linq/transformer lint
pnpm --filter @ts-linq/transformer build
```

Because this is a compiler plugin, also verify downstream packages still compile after changes.

## Do / Don't

- **Do** guard every rewrite by call-site scope.
- **Do** emit diagnostics for unresolved symbols.
- **Don't** swallow TypeChecker errors.
- **Don't** emit AST shapes that diverge from `@ts-linq/ast`.
