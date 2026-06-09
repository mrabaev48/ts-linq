---
"@ts-linq/ast": minor
"@ts-linq/sql-visitor": minor
---

Support JSON-owned nested properties in `isNull` / `isNotNull` / `method` predicate positions.

`IsNullNode.property`, `IsNotNullNode.property` and `MethodNode.object` are widened to
`PropertyNode | JsonPathExpression` (additive union). `JsonAccessRewriter` now propagates a
rewritten JSON path into those positions instead of throwing `UNSUPPORTED_JSON_POSITION`, and
`NullVisitor` / `MethodVisitor` render the path through the dialect's existing `JsonPathTranslator`
port (the same delegation `BinaryVisitor` uses) wrapped in `IS NULL` / `IS NOT NULL` / `LIKE`. This
makes `where(a => a.preferences.theme == null)` and `a.preferences.theme.startsWith('x')`
expressible over JSON-owned navigations across all three dialects, with no spurious parameters on
the null-check form. No dialect source changes were required.
