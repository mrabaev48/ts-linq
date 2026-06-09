---
status: completed
phase: phase-x
package: sql-visitor
priority: P2
effort: S
risk: medium
category: sql
depends_on: []
related: [task-6]
---

# Refactor: `JsonAccessRewriter` silently drops JSON rewrites in `isNull`/`method` positions

## Problem
`JsonAccessRewriter.rewrite` (`packages/sql-visitor/src/JsonAccessRewriter.ts:20-64`)
rewrites multi-segment property paths (`a.preferences.theme`) into `JsonPathNode` so dialects
can emit JSON extraction. But in two branches it **silently abandons the rewrite** when the
property resolves to a JSON path:

- `isNull` / `isNotNull` (`JsonAccessRewriter.ts:49-55`):
  ```ts
  const rewritten = this.rewrite(node.property);
  if (rewritten.type === 'property') return { ...node, property: rewritten };
  // If property resolved to a jsonPath, wrap back — dialects handle IS NULL on JSON paths
  return node;   // <-- original (un-rewritten) node returned
  ```
  The comment claims "dialects handle IS NULL on JSON paths," but the code returns the
  **original** node, so the dialect never sees the `JsonPathNode` — `IS NULL` on a JSON path
  property is emitted against the raw multi-segment property name instead.
- `method` (`JsonAccessRewriter.ts:56-60`): same pattern — if `node.object` rewrites to a
  `jsonPath`, the method node is returned **unchanged**, so e.g.
  `a.preferences.theme.startsWith('d')` loses the JSON rewrite.

## Evidence
- `JsonAccessRewriter.ts:49-55` (isNull/isNotNull) and `:56-60` (method) — both return the
  un-rewritten node when the inner property is a JSON path.
- `IsNullNode`/`MethodNode` in `@ts-linq/ast` type `property`/`object` as `PropertyNode`, so
  the rewriter *can't* place a `JsonPathNode` there without an AST/type change — which is
  why it gives up. The root cause is an AST modeling gap, not just a rewriter bug.

## Why this is bad
- **Silent wrong SQL**: `IS NULL` / string-method predicates on JSON-owned nested properties
  are emitted against a non-existent multi-segment column, producing errors or wrong results
  with no diagnostic.
- **Misleading comment**: the code claims correct handling it doesn't perform.
- **Inconsistent**: `binary`/`logical`/`not` branches rewrite correctly; only these two
  positions are abandoned.

## Target architecture
Either (a) extend the AST so `IsNullNode.property` and `MethodNode.object` can hold a
`JsonPathNode` (preferred — makes the rewrite expressible and lets dialects render JSON path
`IS NULL`/`LIKE`), or (b) if JSON in these positions is genuinely unsupported, **throw a
typed `AstSqlGenerationError`** instead of silently emitting wrong SQL (fail-loud).

## Proposed refactor
1. Decide support policy with the AST/dialect owners.
2. If supporting: widen the relevant AST node fields to `PropertyNode | JsonPathNode`, update
   `NullVisitor`/`MethodVisitor` and dialect JSON path translators to render the JSON-path
   form for `IS NULL` / `LIKE`.
3. If not supporting: replace the `return node` fallbacks with a descriptive
   `AstSqlGenerationError('UNSUPPORTED_JSON_POSITION', ...)`.
4. Remove the misleading comment.

## Suggested design patterns
- **Fail-loud over silent-wrong** — *Why*: a thrown error beats an incorrect query.
- **Make-illegal-states-unrepresentable (AST widening)** — *Why*: if JSON-in-isNull is
  valid, the AST should be able to express it.

## Testing plan
- **Unit**: `a.json.nested == null` → either correct JSON-path `IS NULL` SQL or a thrown
  typed error (per policy).
- **Unit**: `a.json.nested.startsWith('x')` → correct JSON-path `LIKE` or typed error.
- **Regression**: `json-access-rewriter.test.ts`, `sql-visitor-json.test.ts` green.

## Acceptance criteria
- [ ] JSON path in `isNull`/`isNotNull`/`method` positions is either correctly rewritten or
      throws a typed error — never silently un-rewritten.
- [ ] Misleading comment removed/corrected.
- [ ] Tests cover both positions.
- [ ] Existing JSON tests green.

## Refactor order
Independent. If supporting JSON in these positions, coordinate the AST change with the ast
cluster and the dialect JSON translators.

## Notes
Correctness fix → `patch` (fail-loud) or `minor` (new JSON support). Cross-package if the AST
is widened.

## Resolution (completed)
**Policy: Option (b) — fail-loud.** Confirmed via Serena exploration that **no** dialect
JSON-path translator (postgres / mssql / mysql) supports a `JsonPathExpression` in an
`IS NULL` / `IS NOT NULL` or `LIKE`/method position — they emit scalar extraction only
(`->>`, `JSON_VALUE`, `JSON_EXTRACT`). `NullVisitor`/`MethodVisitor` call
`renderPropertyName(PropertyNode)` with zero JSON handling. AST widening (Option a) would be a
large multi-package feature with no current demand, so it is **deferred** → see `task-6`.

Implemented:
- Added `'UNSUPPORTED_JSON_POSITION'` to `AstSqlGenerationErrorCode` in `@ts-linq/ast`
  (`packages/ast/src/errors.ts`) — **minor**.
- Replaced both `return node;` silent-drops in `JsonAccessRewriter`
  (`packages/sql-visitor/src/JsonAccessRewriter.ts`) with a thrown
  `AstSqlGenerationError('UNSUPPORTED_JSON_POSITION', …)` via a single shared
  `unsupportedJsonPosition()` helper; removed the misleading comment — **patch**.
- Tests added in `json-access-rewriter.test.ts` for `isNull` / `isNotNull` / `method` JSON
  paths (throw + code + details) plus positive guards for scalar properties.

Future full-support work (Option a) is tracked in `task-6`.
