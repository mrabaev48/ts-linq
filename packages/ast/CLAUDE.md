# CLAUDE.md — @ts-linq/ast

## Role

The query **intermediate representation (IR)**. Produced by `@ts-linq/transformer`, consumed by
`@ts-linq/sql-visitor` and the dialects. Pure data + small factory helpers; no SQL strings, no I/O.

## Hard boundaries

- May depend **only** on `@ts-linq/types`.
- Must **not** depend on `sql-visitor`, dialects, `query`, `core`, or `orm` (those depend on this).
- No SQL generation here — node shapes only. Dialect-specific rendering belongs in dialects.

## Key modules

- `ast/Nodes.ts` — the canonical node union. Adding a node type ripples into every visitor in
  `sql-visitor` and each dialect emitter; do it deliberately.
- `ast/JsonPathExpression.ts` — JSON-path model. Note: a `JsonPathNode` type is also surfaced from
  `sql-visitor`; keep one source of truth (see refactor task below).
- `nodes/RawSqlNode.ts` — the only sanctioned passthrough for provider-rendered SQL.
- `spec/Specification.ts` — composable predicate objects.
- `errors.ts` — `AstSqlGenerationError`. Re-rooted under `@ts-linq/types`' `OrmError`
  (`types/task-2`) so it shares the project-wide error taxonomy (`instanceof OrmError`, `code`,
  `details`, `cause`); keeps its AST-specific `AstSqlGenerationErrorCode` / `AstSqlGenerationErrorDetails`.

## Public API surface & stability

- Public via `src/index.ts`. Node shapes are a contract for every downstream visitor — treat
  changes as `minor` (additive) or `major` (shape change).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/ast/`:
- `task-1` — ✅ done: de-duplicated the `jsonPath` node definition shared with `sql-visitor`.
- `task-2` — ✅ done: relocated the SQL-fragment DTOs (`ConditionFragment`/`SqlFragment`) to
  `@ts-linq/sql-visitor`. This package no longer exports rendered-SQL carrier shapes; the
  pure-AST boundary (nodes + typed errors, zero SQL generation) is now fully enforced.

## Validation

```bash
pnpm --filter @ts-linq/ast typecheck
pnpm --filter @ts-linq/ast lint
pnpm --filter @ts-linq/ast build
```

## Do / Don't

- **Do** keep nodes as plain data with discriminants; keep factories pure.
- **Don't** embed dialect SQL or rendering logic.
- **Don't** create a second copy of a node type already defined here.
