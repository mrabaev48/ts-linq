---
"@ts-linq/types": minor
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
"@ts-linq/migrations": minor
"@ts-linq/dialect-postgres": patch
"@ts-linq/dialect-mysql": patch
"@ts-linq/dialect-mssql": patch
---

feat(P1-31): implement alternate keys and rich indexes

- Add `hasAlternateKey(selector)` to EntityTypeBuilder — emits named UNIQUE constraints usable as FK targets
- Add `includeProperties(selector)` and `isDescending(flags[])` to IndexBuilder — covering indexes and per-column sort order
- Add lambda-selector overload to `hasIndex(selector)` — mirrors EF Core's API
- Wire `hasPrincipalKey()` → alternate key FK resolution in SchemaSnapshot
- Add `AlternateKeyMetadata` type and `alternateKeys` field to `EntityMetadata`
- Add `UniqueConstraintDef` to DiffTypes; diff + DDL emit alternate keys separately from plain indexes
- All dialects: `generateAddUniqueConstraintSql` / `generateDropUniqueConstraintSql`
- PostgreSQL covering indexes via INCLUDE clause
- MySQL: hasFilter silently dropped with warning (not supported natively)
