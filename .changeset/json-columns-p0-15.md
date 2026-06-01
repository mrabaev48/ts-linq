---
"@ts-linq/ast": minor
"@ts-linq/sql-visitor": minor
"@ts-linq/orm": minor
"@ts-linq/core": patch
"@ts-linq/migrations": patch
"@ts-linq/dialect-postgres": minor
"@ts-linq/dialect-mysql": minor
"@ts-linq/dialect-mssql": minor
"@ts-linq/types": minor
---

feat(P0-15): implement JSON columns — OwnsOne/OwnsMany with ToJson(), LINQ querying into JSON paths, per-dialect SQL translation (Postgres JSONB, MySQL JSON, MSSQL JSON_VALUE), JsonShape descriptor, JsonAccessRewriter, JsonSnapshotter for change tracking, and dialect-native DDL emission.
