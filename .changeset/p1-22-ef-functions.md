---
"@ts-linq/ast": minor
"@ts-linq/query": minor
"@ts-linq/sql-visitor": minor
"@ts-linq/transformer": patch
"@ts-linq/dialect-postgres": minor
"@ts-linq/dialect-mysql": minor
"@ts-linq/dialect-mssql": minor
"@ts-linq/orm": minor
---

feat(P1-22): implement EF.functions and HasDbFunction

Adds `EF.functions` marker object with `like`, `iLike`, `random`, `dateDiffDay`,
`dateDiffMonth`, `greatest`, `least`, `stDev`, `variance` — all as compile-time
markers that throw at runtime outside LINQ expressions.

Adds a new `EfFunctionNode` AST node, transformer CallVisitor recognition of
`EF.functions.xxx(...)` patterns, per-dialect `EfFunctionTranslator` implementations
for PostgreSQL (`postgresEfFunctions`), MySQL (`mysqlEfFunctions`), and MSSQL
(`mssqlEfFunctions`), and `EfFunctionVisitor` in `@ts-linq/sql-visitor`.

Adds `ModelBuilder.hasDbFunction()` with `DbFunctionBuilder.hasName()` for
registering user-defined SQL functions for use in LINQ expressions.
