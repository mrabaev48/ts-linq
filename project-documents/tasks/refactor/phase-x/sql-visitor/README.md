# Refactor Audit: sql-visitor

**Package status: ✅ Done** — tasks 1, 2, 3, 4, 5 ✅ completed. (task-6 is a newly-filed,
optional follow-up feature — full JSON-path support in `isNull`/`method` — not a blocker.)

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
| Order | Task | Priority | Status | Reason |
|---:|---|---|---|---|
| 1 | task-1 | P1 | ✅ Completed | Uniform visitor contract + registry; foundation for the rest. |
| 2 | task-2 | P1 | ✅ Completed | Remove placeholder-numbering hazard (folds into VisitContext). |
| 3 | task-4 | P2 | ✅ Completed | Hide internal visitors so 1 & 2 aren't breaking changes. |
| 4 | task-3 | P2 | ✅ Completed | Correctness: EF function property-as-value binding bug. |
| 5 | task-5 | P2 | ✅ Completed | Correctness/fail-loud: JSON rewrite gap in isNull/method. |
| 6 | task-6 | P2 | ⏳ Pending (follow-up) | Feature: full JSON-path support in isNull/method (deferred Option B). |

> **task-1 outcome:** introduced `VisitContext` + `NodeVisitor<N>` (`src/visitContext.ts`),
> migrated all sub-visitors to the uniform `visit(node, ctx)` contract, replaced
> `SqlVisitor._visit`'s switch with a `Map<ExpressionNode['type'], NodeVisitor>` registry,
> unified `NullVisitor` into a single `visit` (registered under both `isNull`/`isNotNull`), and
> made optional visitors (`efFunction`/`jsonPath`) register their real impl when configured or a
> throwing stub otherwise. SQL output is byte-identical (golden corpus test). Migrating the
> exported sub-visitor signatures is a **breaking change → `major`** for `@ts-linq/sql-visitor`.

> **task-2 outcome:** the placeholder-numbering hazard was already eliminated by task-1 —
> `VisitContext.state` is a *required* field, so no visitor defaults a fresh
> `ParameterState` (the only `new ParameterState` in `src/` is the single shared instance in
> `SqlVisitor.toSql`). task-2 therefore added the permanent **regression guards** rather than
> production changes: a named positional-numbering unit test
> (`shared ParameterState across visitor calls › numbers placeholders continuously ($1, $2
> not $1, $1)` in `tests/Visitors.test.ts`) and a **type-level guard** (`tsd`) asserting that
> omitting `state` from a `VisitContext` / visitor call is a compile error
> (`test-d/index.test-d.ts`, wired via a new `test-d` script). No `src/` change → **no
> changeset** (CLAUDE.md §14: a changeset is required only when `src/` of a versioned package
> changes; tests + test tooling + docs do not qualify).

> **task-4 outcome:** curated the public barrel (`src/index.ts`) down to the intended
> published contract — `SqlVisitor`/`SqlVisitorOptions`, `ParameterState`/`ParameterStyle`,
> rewriters (`JsonAccessRewriter`, `ComplexAccessRewriter`), emitters (`CallSyntaxEmitter`,
> `ExecSyntaxEmitter`, `emitTagComments`, batch helpers) and translator/fragment/port *types*.
> All 11 sub-visitors and the free helpers (`renderPropertyName`, `resolveParameterRef`,
> `isHierarchyMethod`, `isSpatialMethod`) moved behind a new `@ts-linq/sql-visitor/internal`
> subpath (`src/internal.ts`, `@internal`-tagged), added to `package.json` `exports` (mirroring
> `@ts-linq/query`). A **grep** of the monorepo found exactly one external non-test consumer of a
> moved symbol: `query/src/Queryable.ts` imports `FragmentJoinPlanner` — migrated to
> `@ts-linq/sql-visitor/internal`. batch helpers (`calcChunkSize`/`chunkArray`) stay public
> because dialects + `orm` import them. Added a public-barrel **export snapshot test**
> (`tests/index.test.ts`). Resolution wiring for the new subpath was added to
> `tsconfig.json`, `query/tsconfig.json`, `e2e-tests/tsconfig.json`, `jest-config` and the
> `sql-visitor` `tsd` block. Because a sub-visitor was used externally and migrated to
> `/internal`, this is **`major`** for `@ts-linq/sql-visitor`. Knock-on: with visitors now
> internal, the task-1/task-2 signature changes are **no longer a public breaking change**.

> **task-5 outcome:** **Policy = Option B / fail-loud.** Serena exploration confirmed *no*
> dialect JSON-path translator (postgres / mssql / mysql) supports a `JsonPathExpression` in an
> `IS NULL`/`IS NOT NULL` or `LIKE`/method position (all emit scalar extraction only), and
> `NullVisitor`/`MethodVisitor` use `renderPropertyName(PropertyNode)` with zero JSON handling.
> The two `return node;` silent-drops in `JsonAccessRewriter.rewrite` (isNull/isNotNull + method)
> now throw a typed `AstSqlGenerationError('UNSUPPORTED_JSON_POSITION', …)` via a single shared
> `unsupportedJsonPosition()` helper (details carry `nodeType`/`column`/`path`); the misleading
> "dialects handle IS NULL on JSON paths" comment is removed. Added a new
> `'UNSUPPORTED_JSON_POSITION'` member to `AstSqlGenerationErrorCode` in `@ts-linq/ast`
> (**minor**) and unit coverage in `json-access-rewriter.test.ts` (throw + code + details for
> isNull/isNotNull/method, plus scalar-property pass-through guards). Full multi-package JSON
> support (AST widening + visitor + 3 dialect translators) is **deferred** → `task-6`.
> Changeset: `@ts-linq/ast` **minor** + `@ts-linq/sql-visitor` **patch** (correctness fix).

> **task-3 outcome:** fixed `EfFunctionVisitor.resolveParam`'s `PropertyNode`-in-value-position
> branch, which previously emitted a placeholder and bound the **column name string** as a
> parameter (with `resolver = undefined`, dropping `@Column({ name })` mapping). The property
> path now inlines a resolved column reference (`renderPropertyName(arg, resolver)`, no
> placeholder/parameter), matching the already-correct `resolveVariadicArgs`. DRY: extracted a
> shared private `renderArg(arg, inputParameters, resolver, state)` helper that is the single
> source of truth for the property/literal/parameterRef branches; both `resolveParam` (single
> value arg, keeps the `undefined`-arg guard) and `resolveVariadicArgs` now delegate to it.
> `resolver` is threaded through all four single-value callers (`like`, `iLike`, `dateDiffDay`,
> `dateDiffMonth`) — never passed as `undefined` where available. Added two unit tests
> (`tests/EfFunctionVisitor.test.ts`): a two-column `dateDiffDay(start, end)` emitting zero bound
> parameters with resolver-mapped names, and a literal-path regression. The bug is currently
> **unreachable in production** (the EF visitor is not yet wired into `.where()` — see
> `query/task-4.md`); the fix is a pre-emptive guard. Correctness fix, no public API change →
> **`patch`** for `@ts-linq/sql-visitor`.

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
