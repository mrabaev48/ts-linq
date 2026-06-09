---
"@ts-linq/ast": minor
"@ts-linq/sql-visitor": patch
---

Fail loud on JSON paths in `isNull`/`isNotNull`/`method` positions.

`JsonAccessRewriter` previously **silently dropped** the JSON rewrite when a JSON-owned nested
property (e.g. `a.preferences.theme`) resolved into an `IS NULL` / `IS NOT NULL` or
string-method (`LIKE`) position, emitting wrong SQL against a non-existent multi-segment column.
No dialect translator supports a JSON path in these positions, so the rewriter now throws a
typed `AstSqlGenerationError` with the new stable code `UNSUPPORTED_JSON_POSITION` (carrying the
offending `column`/`path` in `details`) instead of producing incorrect SQL.

- `@ts-linq/ast` (**minor**): adds the `UNSUPPORTED_JSON_POSITION` member to
  `AstSqlGenerationErrorCode`.
- `@ts-linq/sql-visitor` (**patch**): correctness fix — replaces the two silent
  pass-through branches with a fail-loud throw and removes the misleading comment.

Full JSON-path support in these positions (AST widening + dialect translators) is deferred; see
`sql-visitor/task-6`.
