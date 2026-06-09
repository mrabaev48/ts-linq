---
status: completed
phase: phase-x
package: sql-visitor
priority: P2
effort: M
risk: medium
category: sql
depends_on: [task-5]
related: [task-5]
---

# Feature: full JSON-path support in `isNull`/`isNotNull`/`method` positions (deferred Option B)

## Context
`task-5` made `JsonAccessRewriter` **fail loud** (`AstSqlGenerationError` with code
`UNSUPPORTED_JSON_POSITION`) when a JSON-owned nested property
(`a.preferences.theme`) resolves into an `isNull` / `isNotNull` / `method` position, because
**no part of the stack supports it today**. This task tracks the deferred "Option B" — making
those positions actually work end-to-end — and records the related JsonColumn gaps found
during the `task-5` diagnosis.

## Problem / current gaps
JSON paths only render correctly inside **binary/logical/not** comparisons (e.g.
`a.preferences.theme === 'dark'`), because `BinaryVisitor.renderOperand` delegates a
non-`PropertyNode` operand to `recurse()` → `JsonPathVisitor` → dialect `JsonPathTranslator`.
Everywhere else the JSON path is unrepresentable:

1. **AST modeling gap** (`@ts-linq/ast`, `src/ast/Nodes.ts`):
   - `IsNullNode.property: PropertyNode` and `IsNotNullNode.property: PropertyNode`
   - `MethodNode.object: PropertyNode`
   None of these can hold a `JsonPathExpression`, so the rewriter cannot legally produce one.

2. **Visitor gap** (`@ts-linq/sql-visitor`):
   - `NullVisitor` (`src/visitors/NullVisitor.ts`) and `MethodVisitor`
     (`src/visitors/MethodVisitor.ts`) both call `renderPropertyName(node.property|object)`
     (`src/visitors/BinaryVisitor.ts:91-100`), which is typed `PropertyNode` and throws
     `INVALID_PROPERTY_NODE` for anything else. No JSON branch exists.

3. **Dialect gap** (`@ts-linq/dialect-postgres|mssql|mysql`, `src/json/JsonPathTranslator.ts`):
   - Each `JsonPathTranslator.translate()` emits a **scalar extraction** expression only
     (`(col->>'k')`, `JSON_VALUE(col,'$.k')`, `(col->>'$.k')`). There is no context-aware
     variant for `… IS NULL` / `… IS NOT NULL` or `… LIKE …`.

4. **Test gap**: no coverage asserting JSON-path `IS NULL` / `LIKE` SQL (only equality is
   tested in `sql-visitor-json.test.ts` / `json-access-rewriter.test.ts`).

## Why this is bad (deferred, not urgent)
Today these predicates fail loud (good — no silent-wrong SQL), but consumers cannot express
`where(a => a.preferences.theme == null)` or `a.preferences.theme.startsWith('d')` over
JSON-owned navigations at all. That is an ergonomics/feature limitation, not a correctness
bug.

## Target architecture (Option B)
Make JSON-in-these-positions **expressible and renderable** end-to-end:

1. **Widen the AST** (`@ts-linq/ast`):
   ```ts
   interface IsNullNode    { property: PropertyNode | JsonPathExpression; ... }
   interface IsNotNullNode { property: PropertyNode | JsonPathExpression; ... }
   interface MethodNode    { object:   PropertyNode | JsonPathExpression; ... }
   ```
   Adding a shape to these contracts ripples into every visitor — treat as **minor** (additive
   union) and audit each consumer.

2. **Teach the visitors** (`@ts-linq/sql-visitor`): in `NullVisitor` / `MethodVisitor`, when
   the field is a `JsonPathExpression`, render via the injected `JsonPathTranslator` (the same
   port `BinaryVisitor` already uses through `recurse`) rather than `renderPropertyName`.
   Keep parameterization through the shared `ParameterState`.

3. **Teach the dialects** (3 `JsonPathTranslator`s): emit the correct JSON-path SQL for
   `IS NULL` / `IS NOT NULL` and for `LIKE` (`startsWith`/`endsWith`/`includes`) — including
   correct cast handling and zero spurious parameters for the null-check form.

4. **Rewriter**: replace the `task-5` `unsupportedJsonPosition()` throw with propagation of the
   rewritten `JsonPathExpression` into the (now type-safe) node field.

## Trigger condition
Implement when **either**:
- a dialect gains JSON-path null-check / pattern-match translator support, **or**
- a consumer concretely needs `IS NULL` / `startsWith`-style predicates over JSON-owned
  nested properties.

Until then, `task-5`'s fail-loud behavior is the correct, safe state.

## Suggested design patterns
- **Make-illegal-states-representable (AST widening)** — let the IR express a valid construct.
- **Port/adapter** — reuse the existing `JsonPathTranslator` port; no `if (dialect === …)`.

## Testing plan
- **Unit**: `a.preferences.theme == null` → correct per-dialect JSON-path `IS NULL` SQL, zero
  spurious parameters.
- **Unit**: `a.preferences.theme.startsWith('x')` → correct per-dialect JSON-path `LIKE` SQL.
- **Regression**: remove the `task-5` fail-loud unit cases only when the positive path replaces
  them; keep `json-access-rewriter.test.ts` / `sql-visitor-json.test.ts` green.

## Acceptance criteria
- [ ] AST widened; all visitors compile against the union.
- [ ] `NullVisitor` / `MethodVisitor` render JSON paths via the translator port.
- [ ] All three dialects emit correct JSON-path `IS NULL` / `LIKE` SQL.
- [ ] Rewriter propagates the JSON path instead of throwing.
- [ ] Unit + regression coverage green across `sql-visitor` and the three dialects.

## Notes
Cross-package: `@ts-linq/ast` (**minor**, widened nodes) + `@ts-linq/sql-visitor` (**minor**,
new capability) + the three dialect packages (**minor**). Coordinate with the ast cluster.
