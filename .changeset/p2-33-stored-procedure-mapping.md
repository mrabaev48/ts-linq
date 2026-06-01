---
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
"@ts-linq/sql-visitor": minor
"@ts-linq/types": minor
"@ts-linq/dialect-postgres": patch
"@ts-linq/dialect-mysql": patch
"@ts-linq/dialect-mssql": patch
---

feat(P2-33): implement stored procedure mapping for Insert/Update/Delete operations

Adds `insertUsingStoredProcedure()`, `updateUsingStoredProcedure()`, and `deleteUsingStoredProcedure()`
fluent API on `EntityTypeBuilder<T>`. When configured, `SaveChanges` routes entity CUD operations
to dialect-specific CALL/EXEC statements instead of inline DML. Supports input/output parameters,
original-value parameters, and rows-affected via result column, OUT parameter, or return value.
Implemented for PostgreSQL (CALL), MySQL (CALL + follow-up SELECT), and MSSQL (EXEC).
