---
"@ts-linq/ast": minor
"@ts-linq/sql-visitor": minor
"@ts-linq/dialect-postgres": patch
"@ts-linq/dialect-mysql": patch
"@ts-linq/dialect-mssql": patch
---

De-duplicate the `jsonPath` AST node: restore a single source of truth.

**What changed**

- **`@ts-linq/ast`** — `Nodes.ts` no longer redeclares the `jsonPath` node inline. The
  `ExpressionNode` union now references the canonical `JsonPathExpression` directly, and the
  misleading "re-export … imported inline" comment was removed. `JsonPathNode` is retained as a
  `@deprecated` type alias (`export type JsonPathNode = JsonPathExpression`) so existing imports
  keep compiling. No runtime/shape change.
- **`@ts-linq/sql-visitor`** — now re-exports the canonical `JsonPathExpression` (additive);
  the internal `JsonAccessRewriter` and `JsonPathVisitor`/`JsonPathTranslator` were migrated to
  it. The `JsonPathNode` re-export is kept as `@deprecated` for backward compatibility.
- **`@ts-linq/dialect-{postgres,mysql,mssql}`** — JSON-path translators now reference
  `JsonPathExpression` instead of the deprecated `JsonPathNode` alias. Internal type rename only;
  no behavioral change.

**Migration**

No action required — `JsonPathNode` still resolves via a deprecated alias. New code should import
`JsonPathExpression` from `@ts-linq/ast` (or `@ts-linq/sql-visitor`). The `JsonPathNode` alias is
slated for removal in a future major release.
