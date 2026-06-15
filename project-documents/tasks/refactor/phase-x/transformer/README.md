# Refactor Audit: transformer

**Status: 🔄 In Progress** — tasks 4, 3, 2 ✅ completed; task 1 pending.

## Package responsibility
`@ts-linq/transformer` is the **compile-time** ts-patch transformer that rewrites
`.where(...)`, `.having(...)`, `.select(...)` and `hasQueryFilter(...)` calls on branded
Queryable/EntityTypeBuilder receivers into their pre-compiled `*Compiled` equivalents. It
parses the TypeScript arrow-function predicate AST into a serializable `ExpressionNode` tree
(consumed at runtime by `@ts-linq/sql-visitor`), captures runtime values as parameter
references, and emits `DiagnosticSink` errors for unsupported expressions. It is
compile-time-only: no runtime/public API surface beyond the transformer factory and node
types.

## Current architectural problems
This package is the **cleanest of the C2 cluster** (it has already undergone the RF-01 clean
architecture refactor: `DiagnosticSink`, `DISPATCH_MAP`, visitor split, `recurse` field to
break circular imports, a single authorised `as unknown as` cast at
`DiagnosticSink.ts:43`). Remaining issues are moderate:

- **Two near-identical entrypoints** (`index.ts` default export and
  `WhereTransformer.createWhereTransformer`) duplicate the traversal + the fragile
  hand-written chained-receiver re-rewrite block — DRY/maintainability risk on the package's
  highest-risk code (task-3).
- **Scope guards silently swallow TypeChecker failures** (`catch { return false }`),
  converting a compile-time type-resolution failure into a confusing *runtime* throw with no
  build-time diagnostic (task-4).
- **`makeUnsupported` hardcodes `where()`** in diagnostics even for `having`/`select`/
  `hasQueryFilter` predicates, despite `methodName` being available (task-2).
- **`CallVisitor` is a 216-LOC mega-module** mixing four call patterns + duplicated literal
  conversion (task-1).

## Refactor goals
1. One shared traversal/dispatch implementation behind both entrypoints.
2. Make transformer-skip failures observable (warn) instead of silently deferring to a
   runtime throw.
3. Method-accurate diagnostics.
4. Decompose `CallVisitor` by pattern; DRY the literal conversion.

## Recommended task order
| Order | Task | Priority | Status | Reason |
|---:|---|---|---|---|
| 1 | task-4 | P1 | ✅ Completed | Silent skip → runtime throw is a real DX defect; make it visible. |
| 2 | task-3 | P1 | ✅ Completed | De-duplicate the two entrypoints + the fragile receiver-patch. |
| 3 | task-2 | P2 | ✅ Completed | Method-accurate diagnostics (trivial, high clarity). |
| 4 | task-1 | P2 | ⬜ Pending | Split CallVisitor mega-module; DRY literal conversion. |

## Dependencies on other packages
- `typescript` (peer dependency) — the entire package operates on the TS AST/TypeChecker.
- `@ts-linq/ast` — produces `ExpressionNode` shapes (via object-literal builders) that
  `@ts-linq/sql-visitor` later consumes; the contract between the two is the AST node schema.
- `@ts-linq/types` — minor type usage.
- **Tightly coupled at the contract level to `@ts-linq/query`**: it depends on the runtime
  brands `__tsLinqWhereTransformerBrand` / `__tsLinqEntityTypeBuilderBrand` and emits
  `whereCompiled`/`havingCompiled`/`selectCompiled`/`hasQueryFilterCompiled` calls that must
  match the query package's method names exactly. Any rename on either side is a coordinated
  breaking change.

## Testing strategy
- Strong existing unit coverage (`tests-new/unit/**`, type-test for `ExpressionNode`).
- Add: chained-call regression for the shared visitor (task-3), checker-failure warning
  test (task-4), method-name diagnostic test (task-2), per-pattern CallVisitor tests
  (task-1).
- Because output is compile-time AST, prefer **AST-output snapshot** assertions to lock
  behavior across refactors.

## Notes
Per repo changeset rules, compile-time-only changes with no runtime behavior change need no
changeset; task-4 changes *diagnostic* behavior (adds a warning) which is worth a `patch`
note. The contract coupling to `@ts-linq/query` (brand names + `*Compiled` method names) is
the single most important invariant to preserve in any cross-cluster refactor.
