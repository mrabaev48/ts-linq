---
status: completed
phase: phase-x
package: sql-visitor
priority: P1
effort: M
risk: medium
category: architecture
depends_on: []
related: ["query/task-4.md"]
---

# Refactor: Unify the visitor contract and make node dispatch extensible (registry, not switch)

## Problem
The sub-visitors in `sql-visitor` each expose an **ad-hoc, divergent `visit` signature**, and
`SqlVisitor._visit` hard-codes node→visitor routing in a `switch`. There is no shared
`NodeVisitor` interface, so adding a node type or visitor means editing the central switch
and matching one of several incompatible call conventions.

### Divergent signatures
- `BinaryVisitor.visit(node, inputParameters, recurse, resolver, state, converterResolver)`
  (`visitors/BinaryVisitor.ts:21-28`).
- `LogicalVisitor.visit(node, recurse)` (`visitors/LogicalVisitor.ts:6-9`).
- `UnaryVisitor.visit(node, recurse, resolver, state)`.
- `NullVisitor.visitIsNull(node, resolver)` / `visitIsNotNull(node, resolver)` —
  *different method names*.
- `InVisitor.visit(node, inputParameters, resolver, state)`
  (`visitors/InVisitor.ts:10-15`).
- `MethodVisitor.visit(node, inputParameters, resolver, state)` (`MethodVisitor.ts:16-21`).
- `EfFunctionVisitor.visit(node, inputParameters, resolver, state)`
  (`EfFunctionVisitor.ts:16-21`).
- `JsonPathVisitor.visit(node, state)`.

### Central switch
`SqlVisitor._visit` is a 12-case `switch` (`SqlVisitor.ts:121-173`) that must thread the
right subset of `(inputParameters, recurse, resolver, state, converterResolver)` to each
visitor by hand.

## Evidence
- File:line references above, all current.
- Contrast with the **transformer** package, which already uses a clean
  `DISPATCH_MAP: Partial<Record<ts.SyntaxKind, VisitorFn>>` registry
  (`packages/transformer/src/expression/ExpressionDispatcher.ts:14-35`) — the sql-visitor
  package has the inverse pattern and would benefit from the same approach.

## Why this is bad
- **OCP**: every new node type edits `SqlVisitor._visit`; visitors can't be registered.
- **Inconsistency / cognitive load**: six different call conventions for "visit a node."
- **Error-prone threading**: each call site manually picks which of the 6 params to pass;
  forgetting `state` silently falls back to a fresh `ParameterState` (see
  `sql-visitor/task-2.md`).

## Target architecture
Introduce a single `NodeVisitor` contract and a **visitor registry** (mirroring the
transformer's `DISPATCH_MAP`), passing one cohesive `VisitContext`:

```ts
interface VisitContext {
  inputParameters: readonly unknown[];
  resolver?: ColumnResolver;
  converterResolver?: ConverterResolver;
  state: ParameterState;
  recurse(node: ExpressionNode): ConditionFragment;
}
interface NodeVisitor<N extends ExpressionNode> {
  visit(node: N, ctx: VisitContext): ConditionFragment;
}
```

`SqlVisitor` holds a `Map<ExpressionNode['type'], NodeVisitor>` and dispatches uniformly;
optional translators (spatial/json/ef) register their visitors only when configured.

## Proposed refactor
1. Define `VisitContext` and `NodeVisitor<N>`.
2. Adapt each existing visitor to the uniform `visit(node, ctx)` signature (rename
   `NullVisitor.visitIsNull/visitIsNotNull` into one visitor keyed by node type, or two
   registry entries).
3. Replace `SqlVisitor._visit`'s switch with a registry lookup; missing handler →
   `AstSqlGenerationError` (preserving today's behavior at `SqlVisitor.ts:161-172`).
4. Register optional visitors (spatial/hierarchy/json/ef) only when their translator is
   present (preserves the current "throw if not configured" semantics, but centrally).

## Suggested design patterns
- **Visitor + Registry/Dispatch table** — *Why*: OCP for node types; one uniform contract;
  matches the transformer package for cross-package consistency.
- **Context Object** (`VisitContext`) — *Why*: replaces 6 positional params; eliminates
  state-threading mistakes.

## Testing plan
- **Unit**: registry dispatches each node type to the right visitor; unknown type throws.
- **Regression**: existing `Visitors.test.ts`, `index.test.ts`, function/json tests green.
- **Contract**: SQL output byte-identical before/after for a representative AST corpus.

## Acceptance criteria
- [ ] Single `NodeVisitor` interface + `VisitContext` adopted by all sub-visitors.
- [ ] `SqlVisitor` dispatches via a registry, not a hand-written switch.
- [ ] Optional translators register conditionally.
- [ ] SQL output unchanged (snapshot/corpus test).
- [ ] Existing tests green.

## Refactor order
Foundational for the package; do before/with `sql-visitor/task-2.md` (state threading) since
`VisitContext` carries the single `ParameterState`.

## Notes
Internal refactor — no public API change if the registry stays behind `SqlVisitor`. `patch`.
