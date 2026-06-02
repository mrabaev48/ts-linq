---
'@ts-linq/ast': patch
---

fix(ast): re-root AstSqlGenerationError under OrmError for unified error taxonomy

`AstSqlGenerationError` now extends `@ts-linq/types`' `OrmError` instead of `Error`, so it shares
the project-wide error taxonomy (`instanceof OrmError`, `code`, `details`, `cause`). Its
AST-specific `code` union and `details` payload are unchanged; constructor signature is preserved.
