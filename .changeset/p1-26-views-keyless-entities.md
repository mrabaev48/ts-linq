---
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
"@ts-linq/migrations": minor
"@ts-linq/dialect-postgres": patch
"@ts-linq/dialect-mysql": patch
"@ts-linq/dialect-mssql": patch
"@ts-linq/query": patch
---

Add `toView()`, `hasNoKey()`, and `hasViewSql()` for mapping entities to database views as keyless (read-only) types. Keyless entities are never tracked, throw `KeylessMutationError` on mutations, and query via `FROM viewName` in all dialects.
