# refactor sql-visitor/task-6: JSON-path in isNull/isNotNull/method (Option B)

Status: ✅ completed. Replaces task-5's fail-loud with positive rendering.

## AST widening (`@ts-linq/ast`, src/ast/Nodes.ts) — minor
- `IsNullNode.property`, `IsNotNullNode.property`, `MethodNode.object` widened to
  `PropertyNode | JsonPathExpression` (additive union; `JsonPathExpression` already imported in
  Nodes.ts and already in the `ExpressionNode` union).
- Downstream packages resolve `@ts-linq/ast` via built `.d.ts` → **must `pnpm --filter @ts-linq/ast build`**
  before downstream typecheck sees the widened fields (otherwise stale errors).

## sql-visitor changes — minor
- `JsonAccessRewriter.rewrite`: isNull/isNotNull/method branches now **propagate** the rewritten
  node (`if (type==='property' || type==='jsonPath') return {...node, property/object: rewritten}`),
  removed `unsupportedJsonPosition()` helper + `AstSqlGenerationError` import.
- `NullVisitor`: if `node.property.type==='jsonPath'` → `ctx.recurse(node.property)` then wrap
  `(${inner.condition} ${operator})`, propagate inner.parameters (translators yield 0).
- `MethodVisitor`: if `node.object.type==='jsonPath'` → render col via `ctx.recurse`; LIKE wraps it.
  Needed `import type { SqlParameter } from '@ts-linq/types'`.
- `SpatialMethodVisitor` / `HierarchyMethodVisitor`: added guard `if (node.object.type!=='property')
  throw UNSUPPORTED_METHOD` — these methods are NOT supported over JSON paths (also needed so
  `renderPropertyName(node.object)` still type-checks after the union widening).
- `ComplexAccessRewriter`: NO change needed (its else returns `node`, still assignable).

## Key decision: NO dialect changes / NO `translateForNullCheck`
The task body asked for a per-dialect `translateForNullCheck`, but the existing scalar
`JsonPathTranslator.translate()` composes correctly: `(<scalar> IS NULL)` and `(<scalar> LIKE ?)`
work for postgres/mysql/mssql. So the wrapping lives in the visitor (same as
`BinaryVisitor.renderOperand`), reusing the port. Confirmed with user. → changeset is **2 packages**
(ast + sql-visitor), NOT 5; the 3 dialect packages only gained tests (no changeset).

## Tests
- `sql-visitor/tests/json-access-rewriter.test.ts`: 3 throw-cases → propagation cases.
- `sql-visitor/tests/sql-visitor-json.test.ts`: stub-translator IS NULL / IS NOT NULL / LIKE.
- each dialect `src/__tests__/json-path-translator.test.ts`: e2e via `SqlVisitor` + real translator.
  Param-style gotchas: postgres Positional `$1`, mysql Question `?`, **mssql Named starts at `@p1`**.
  Dialects do NOT depend on `@ts-linq/ast` — import `JsonPathExpression` from `@ts-linq/sql-visitor`,
  build nodes structurally with `as const` (no IsNullNode/MethodNode import needed; assignable to
  `ExpressionNode` param of `toSql`).
- `ast/tests/Nodes.test.ts`: compile-time + runtime widening assertions (ast has no tsd setup).

## Validation: all green
typecheck, lint (0 errors), test:unit (3065), build, arch:deps/cycles/dead, integration, e2e (290).

## Tech debt
- MySQL `->>` returns string `'null'` (not SQL NULL) for stored JSON `null` → `IS NULL` catches
  absent/SQL-null but not JSON-null. Precise detection (JSON_TYPE/JSON_EXTRACT) deferred; would be a
  future `translate(path, context)` signature.
- `InNode` (`a.preferences.theme in [...]`) has the same JSON gap — out of scope.
- Nested arrays / cast variants in null/LIKE positions.
