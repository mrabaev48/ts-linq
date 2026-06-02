---
status: not-started
phase: phase-x
package: transformer
priority: P2
effort: M
risk: low
category: architecture
depends_on: []
related: ["transformer/task-2.md"]
---

# Refactor: Split the `CallVisitor` mega-module by call pattern

## Problem
`packages/transformer/src/expression/visitors/CallVisitor.ts` (216 LOC, the largest file in
the package) is a single module handling **four distinct call-expression patterns** plus
their literal-extraction helpers:

- Pattern A — entity string methods (`.includes/.startsWith/.endsWith`) →
  `visitStringMethod` (`CallVisitor.ts:116-137`).
- Pattern B — array-literal `.includes` (IN) → `visitArrayIncludes` (`:73-96`).
- Pattern C — identifier `.includes` (IN with captured var) → `visitIdentifierIncludes`
  (`:98-114`).
- Pattern D — `EF.functions.xxx(...)` → `visitEfFunction` + `resolveEfArg` (`:158-206`).
- Plus shared helpers `extractArrayElementLiteral` (`:139-156`),
  `extractPropertyNode` (`:208-216`), `isEfFunctionsCall` (`:21-29`), and two `Set`
  constants (`STRING_METHODS`, `EF_FUNCTIONS`, `:7-19`).

The dispatching `visit` (`:31-71`) is a chain of `if` guards that must be read top-to-bottom
to understand which pattern wins.

## Evidence
- 216 LOC, multiple responsibilities: `CallVisitor.ts` (whole file).
- Four `visitX` functions + four helper functions in one module.
- Literal-extraction logic (`extractArrayElementLiteral` `:139-156`) is near-duplicated with
  `resolveEfArg`'s literal handling (`:182-200`) — both turn TS literal nodes into AST
  literal objects.

## Why this is bad
- **SRP at module granularity**: one file changes for any call-pattern change.
- **Duplication**: two literal→AST converters drift independently.
- **Readability**: the `if`-guard order in `visit` encodes precedence implicitly.

## Target architecture
Decompose into focused, independently testable units under
`expression/visitors/calls/`:

- `StringMethodCall` (Pattern A), `ArrayIncludesCall` (B), `IdentifierIncludesCall` (C),
  `EfFunctionCall` (D) — each a small `visit`-shaped function.
- A shared `literalToAstNode(node)` helper used by both the array and EF paths (DRY).
- `CallVisitor.visit` becomes a thin **chain-of-responsibility / pattern matcher** that tries
  each handler and returns the first match, falling back to `makeUnsupported`.

This mirrors the package's existing clean `DISPATCH_MAP` philosophy
(`ExpressionDispatcher.ts:14`) at a finer grain.

## Proposed refactor
1. Extract the shared `literalToAstNode` helper; replace both copies.
2. Move each pattern into its own module exposing a `tryVisit(node, tctx, depth):
   ts.Expression | null` (null = not my pattern).
3. `CallVisitor.visit` iterates an ordered handler array and returns the first non-null,
   else `makeUnsupported(node, tctx.sink)`.

## Suggested design patterns
- **Chain of Responsibility** for pattern matching — *Why*: explicit, ordered, extensible
  pattern resolution instead of nested `if`s.
- **Extract Function / DRY** for literal conversion — *Why*: one source of truth.

## Testing plan
- **Unit**: each pattern handler tested in isolation (existing `CallVisitor.test.ts` already
  covers behaviors — split assertions per handler).
- **Regression**: `CallVisitor.test.ts` green; AST output unchanged.

## Acceptance criteria
- [ ] Each call pattern lives in its own module.
- [ ] One shared `literalToAstNode` helper (no duplicate literal converters).
- [ ] `CallVisitor.visit` is a thin ordered dispatcher.
- [ ] AST output unchanged; `CallVisitor.test.ts` green.

## Refactor order
Independent; low risk. Good cleanup once the higher-priority query/sql-visitor work lands.

## Notes
Compile-time-only code (no runtime API surface) → no changeset needed for this package per
repo rules unless behavior changes.
