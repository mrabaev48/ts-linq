# Refactor Audit: ast

**Status: 🔄 In Progress** — task-1 ✅ completed; task-2 pending.

## Package responsibility
`@ts-linq/ast` defines the query expression AST: the `ExpressionNode` union and its member
node interfaces (property, literal, binary, logical, IN, method, EF-function, json-path,
unsupported), the `RawSqlNode` query-source descriptor, the `Specification` composition
abstraction, and the typed `AstSqlGenerationError`. It depends only on `@ts-linq/types`.

## Current architectural problems
This is the **cleanest package in cluster C1**. It correctly contains *no* SQL string
generation, *no* provider/dialect logic, and a well-structured typed error (`code` + `details`
+ `name`) that the rest of the project should emulate. Only two minor issues were found:
- **Duplicated `jsonPath` node**: `JsonPathNode` (inline in `Nodes.ts`) and `JsonPathExpression`
  (`JsonPathExpression.ts`) are two independent identical interfaces; the `ExpressionNode`
  union uses the inline copy, and a comment falsely claims a re-export. Divergence risk (task-1).
- **SQL-fragment DTOs in a pure-AST package**: `ConditionFragment`/`SqlFragment` in `types.ts`
  are rendered-SQL carriers that arguably belong in the SQL-generation layer (task-2).

## Refactor goals
- Restore single-source-of-truth for the `jsonPath` node.
- Protect the pure-AST boundary by clarifying/relocating SQL-fragment DTOs.
- Keep the package free of any SQL/provider/dialect logic (it already is).

## Recommended task order
| Order | Task | Priority | Status | Reason |
|---:|---|---|---|---|
| 1 | task-1 | P1 | ✅ completed | De-duplicate `jsonPath` node before any node edits |
| 2 | task-2 | P2 | ⬜ pending | Investigate/relocate SQL-fragment DTOs (boundary hygiene) |

## Dependencies on other packages
- Inbound: `@ts-linq/types` (for `SqlParameter`).
- Outbound: consumed by the query/SQL-generation and dialect packages (which translate nodes
  to SQL). Keep the AST package the upstream, generation-free layer.

## Testing strategy
- Type-level tests that `ExpressionNode` references the canonical `jsonPath` type and that the
  Specification combinators fold correctly into `LogicalNode` trees.
- `arch:deps`/`madge` to confirm no SQL-generation dependency leaks in.
- Regression: JSON-path translation and Specification→AST tests pass.

## Notes
The package's typed error (`AstSqlGenerationError`, `errors.ts`) is the reference model for the
cluster-wide error consolidation in `types/task-2` — align the shared `OrmError` taxonomy to it
rather than the other way around.
