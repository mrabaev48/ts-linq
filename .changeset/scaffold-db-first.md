---
"@ts-linq/migrations": minor
"@ts-linq/dialect-postgres": minor
"@ts-linq/dialect-mysql": minor
"@ts-linq/dialect-mssql": minor
"@ts-linq/cli": minor
"@ts-linq/types": minor
---

feat(P2-43): implement database-first scaffolding (reverse engineer)

Add `scaffoldDbContext()` to `@ts-linq/migrations` that reverse-engineers an existing database into TypeScript entity classes and a `DbContext`. Includes per-dialect introspectors (`PostgresDbIntrospector`, `MySqlDbIntrospector`, `MssqlDbIntrospector`) exported from dialect packages, a name normalizer with `--use-database-names` / `--no-pluralize` options, entity and DbContext code generators, and a new `scaffold` CLI command.
