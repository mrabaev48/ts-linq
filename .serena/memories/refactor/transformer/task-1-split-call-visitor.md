# refactor/transformer/task-1 — Split CallVisitor by call pattern (done — 2026-06-15)

✅ DONE transformer's **4TH and FINAL** task (order: task-4 → task-3 → task-2 → **task-1**).
**`transformer` package now FULLY COMPLETE (tasks 1–4).** Next package = `migrations` (step 10).

## What changed

`packages/transformer/src/expression/visitors/CallVisitor.ts` (was 216-LOC mega-module with
four call patterns + duplicated literal conversion) → decomposed via **Chain of Responsibility**
into `expression/visitors/calls/`:

- `shared.ts` — `CallHandler` type, `STRING_METHODS`/`EF_FUNCTIONS` Set constants,
  `isEfFunctionsCall`, `extractPropertyNode`, **shared `literalToAstNode`** (single literal→AST
  converter; returns bare literal expr or `null`).
- `ArrayIncludesCall.ts` (Pattern B), `IdentifierIncludesCall.ts` (C), `StringMethodCall.ts` (A),
  `EfFunctionCall.ts` (D, owns local `resolveEfArg`). Each exposes
  `tryVisit(node, tctx, depth): ts.Expression | null` (`null` = not my pattern). All typed to
  `CallHandler`; unused trailing `depth` named `_depth` in B/C/D (only A uses it for `tctx.recurse`).
- `CallVisitor.visit` → thin ordered dispatcher: iterates `HANDLERS = [Array, Identifier, String, Ef]`
  (precedence preserved from original `if`-chain: **B→C→A→D**), returns first non-null, else
  method-aware `makeUnsupported(node, { sink, methodName })` (task-2 form, no hardcoded where()).
- `ExpressionDispatcher` unchanged — still `import * as CallVisitor; CallVisitor.visit as VisitorFn`.

## Critical "commit vs fall-through" contract (preserves AST exactly)

Each handler first checks `isPropertyAccessExpression(node.expression)` → null if not. Then checks
its discriminating guard (same as original `if`). Guard fails → null (try next). Guard matches →
**commits**: even if inner property extraction fails it returns `makeUnsupported(<inner node>, …)`
pointing at the SAME node as original (`arg0`/`receiver`, not whole call). This reproduces the
original behaviour byte-for-byte.

## DRY decision (user-chosen: SUPERSET / full DRY)

`literalToAstNode` handles string/number/true/false/null **AND negative numerics** (`-5` via
PrefixUnary minus + numeric). Both array and EF paths delegate to it. **Behaviour change on one
untested edge:** `EF.functions.xxx(p.x, -5)` now emits an inline literal instead of a captured
`parameterRef` (array path always did this; semantically equivalent SQL — latent fix). User
required explicit tests for this. → **`patch` changeset** for `@ts-linq/transformer` (2.1.25 →
2.1.26) documenting the EF negative-literal change (NOT the default "no changeset" the task
assumed, because emitted AST changed).

## Tests

New `tests-new/unit/visitors/calls/`: per-handler suites (Array/Identifier/String/EfFunctionCall)
each testing match + commit-unsupported + returns-null-when-not-mine; `shared.test.ts` proves array
& EF paths embed identical `{type:'literal', value}` objects and covers all literal forms;
**mandatory new edge tests**: `EF.functions.dateDiffDay(l.createdAt, -5)` → inline literal + empty
`tctx.parameters`; `[-5,-10].includes(u.age)` → negative literals (array regression). New
`CallVisitor.snapshot.test.ts` — `toMatchSnapshot()` AST lock for A/B/C/D + unsupported. Existing
`CallVisitor.test.ts` kept green (dispatcher-level regression). Transformer visitor suite: 12
suites / 80 tests / 6 snapshots all green.

## Validation (all green)

typecheck ✅ · lint ✅ (0 errors; new files clean) · unit 3449 ✅ · integration 461 ✅ · e2e 290 ✅ ·
build ✅ · arch:deps/cycles/dead ✅ (no new cycles, no dead exports). `args:'after-used'` +
`argsIgnorePattern:'^_'` is why unused trailing `depth` must be `_depth`.

## OCP follow-up

New call patterns can now be added as a handler module + one array entry in `CallVisitor.HANDLERS`
without touching existing handlers (open for extension). Only remaining literal-handling is the
array path's own minus branch — already routed through `literalToAstNode`; no duplicate converters
remain.

See [[refactor/transformer/task-2-method-aware-diagnostics]],
[[refactor/transformer/task-3-dedup-entrypoints]],
[[refactor/transformer/task-4-visible-checker-failures]], [[transformer/rf-01-clean-architecture]].
