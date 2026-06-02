# Refactor Audit: sql-visitor

## Package responsibility
`@ts-linq/sql-visitor` converts a compiled `ExpressionNode` AST (from `@ts-linq/transformer`)
into a parameterized SQL `ConditionFragment` (`{ condition, parameters }`). It owns the
WHERE/HAVING predicate visitors (binary, logical, unary, null, in, method, EF-function,
spatial, hierarchy, JSON path), the `ParameterStyle`/`ParameterState` placeholder model,
pre-pass rewriters (`JsonAccessRewriter`, `ComplexAccessRewriter`), stored-procedure call
emitters, batch-insert helpers, and tag-comment emission. SQL is built from a structured AST
with values bound as parameters — there is no user-string concatenation into predicates,
which is the package's core safety property.

## Current architectural problems
- **No uniform visitor contract**: 6+ divergent `visit` signatures and a hand-written
  dispatch switch in `SqlVisitor._visit` — not extensible (OCP), unlike the transformer's
  clean `DISPATCH_MAP` (task-1).
- **Dangerous `ParameterState` defaults**: every value-emitting visitor defaults to a fresh
  `new ParameterState(Question)`, so a missed shared-state thread silently mis-numbers
  placeholders (task-2).
- **`EfFunctionVisitor.resolveParam` binds a column name as a literal parameter** for
  property-in-value-position (task-3) — a correctness bug, inconsistent with the variadic
  path in the same file.
- **`JsonAccessRewriter` silently drops JSON rewrites** in `isNull`/`method` positions,
  emitting wrong SQL against multi-segment property names (task-5).
- **Internal sub-visitors + free helpers are exported from the public barrel**, freezing
  unstable signatures as public contract and blocking the above refactors (task-4).

## Refactor goals
1. One `NodeVisitor` contract + a dispatch registry; conditional registration of optional
   translators.
2. Make `ParameterState` a required, shared collaborator (no silent re-creation).
3. Fix EF-function property-as-value rendering.
4. Make JSON-path handling in all node positions correct or fail-loud.
5. Curate the public API; hide internal visitors.

## Recommended task order
| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1 | P1 | Uniform visitor contract + registry; foundation for the rest. |
| 2 | task-2 | P1 | Remove placeholder-numbering hazard (folds into VisitContext). |
| 3 | task-4 | P2 | Hide internal visitors so 1 & 2 aren't breaking changes. |
| 4 | task-3 | P2 | Correctness: EF function property-as-value binding bug. |
| 5 | task-5 | P2 | Correctness/fail-loud: JSON rewrite gap in isNull/method. |

## Dependencies on other packages
- `@ts-linq/ast` — consumes `ExpressionNode` and all node subtypes; throws
  `AstSqlGenerationError`. task-5 may require widening AST node fields here.
- `@ts-linq/types` — `SqlParameter`, translator interfaces (`SpatialTranslator`,
  `HierarchyIdTranslator`, `JsonShape`), SP/batch config types.
- **Consumed by** `@ts-linq/query` (the only production caller — always via `new SqlVisitor()`;
  see `query/task-4.md`) and the dialect packages (which supply translators and run the
  parameter-style tests).

## Testing strategy
- Maintain a representative AST→SQL **corpus snapshot** so the task-1 dispatch refactor is
  provably output-preserving.
- Add **positional-numbering** regression tests (task-2), a **two-column EF function** test
  (task-3), and **JSON-in-isNull/method** tests (task-5).
- Run dialect parameter-style tests (PG `$N`, MSSQL `@pN`) — they are the only consumers of
  `ParameterStyle.Positional`/`Named` today.

## Notes
The package's safety posture is sound (parameterized values, no predicate string-concat).
The findings are about *internal consistency, extensibility, and two latent correctness
bugs* — not injection risk. Note that `ParameterStyle.Positional`/`Named` are exercised only
by dialect tests; in the live query pipeline `SqlVisitor` always runs with `Question` and the
dialect rewrites `?`→`$N` (see `query/task-4.md`).
