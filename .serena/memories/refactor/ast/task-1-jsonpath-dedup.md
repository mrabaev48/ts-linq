# refactor ast/task-1: de-dupe `jsonPath` node (JsonPathNode → JsonPathExpression)

**Status: completed.** `ast` package now 🔄 In Progress (task-2 — SQL-fragment DTOs — still pending).

## Decision: alias, not removal
`JsonPathNode` was a **public** export consumed by name in `sql-visitor` (re-export +
`JsonAccessRewriter`, `JsonPathVisitor`/`JsonPathTranslator`) and all three dialects' JSON-path
translators (`dialect-{postgres,mysql,mssql}/src/json/JsonPathTranslator.ts`) + their tests.
→ kept as a `@deprecated` **type alias** for backward compat, removal deferred to a future major.

## Single source of truth
- `packages/ast/src/ast/Nodes.ts`: deleted the inline duplicate `interface JsonPathNode` and the
  false "Re-export … imported inline" comment; added `import type { JsonPathExpression } from
  './JsonPathExpression'`; `ExpressionNode` union now references `JsonPathExpression` directly;
  added `export type JsonPathNode = JsonPathExpression` (`@deprecated`).
- Canonical definition stays in `packages/ast/src/ast/JsonPathExpression.ts` (unchanged).
- `index.ts` unchanged: `JsonPathExpression` from its module, alias via `export * from './ast/Nodes'`.
  Type-only import in `Nodes.ts` is not re-exported → no duplicate symbol.

## Internal consumers migrated to canonical
All monorepo `src` usages now use `JsonPathExpression`; the deprecated alias has **no internal
users left** (only external back-compat + one ast type-test asserting alias equivalence):
- `sql-visitor/src/index.ts`: now `export type { JsonPathExpression }` (additive) **and** keeps
  `@deprecated export type { JsonPathNode }`. Dialects import the canonical type via this re-export.
- `sql-visitor/src/JsonAccessRewriter.ts`, `src/visitors/JsonPathVisitor.ts`: annotations + docs.
- `dialect-{postgres,mysql,mssql}/src/json/JsonPathTranslator.ts`: `translate(node: JsonPathExpression)`;
  postgres also `toPgType(cast: NonNullable<JsonPathExpression['cast']>)`.
- Tests: 3 dialect `json-path-translator.test.ts` `makeNode` sigs + `sql-visitor/tests/json-access-rewriter.test.ts`.

## Type-level coverage
`ast` has **no** tsd/test-d wiring (only build/typecheck/lint) — did NOT add new tooling. Added
compile-time assertions inside existing jest `packages/ast/tests/Nodes.test.ts`: `ExpressionNode`
accepts a `jsonPath` literal; mutual assignability `JsonPathNode` ↔ `JsonPathExpression`.

## Gotcha: cross-package types resolve via dist
Dialect `typecheck` resolves `@ts-linq/sql-visitor` against its built `.d.ts`, not src — had to
`pnpm --filter @ts-linq/ast --filter @ts-linq/sql-visitor build` before repo-wide `typecheck`
picked up the new `JsonPathExpression` export. `@typescript-eslint/no-deprecated` is **not** active
(config uses `recommendedTypeChecked`, rule only in strict-type-checked) → no eslint-disable needed.

## Validations (all green)
typecheck ✓, lint ✓ (0 errors), test:unit ✓ (3027), test:integration ✓ (464), test:e2e ✓ (290),
build ✓, arch:deps ✓, arch:cycles ✓, arch:dead ✓.

## Changeset
`@ts-linq/ast` minor, `@ts-linq/sql-visitor` minor, `dialect-{postgres,mysql,mssql}` patch.

## Follow-up
- Remove the `JsonPathNode` alias in a future major once external consumers migrate.
- ast/task-2: relocate SQL-fragment DTOs (`ConditionFragment`/`SqlFragment` in `types.ts`) — next.
