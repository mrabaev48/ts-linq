---
'@ts-linq/orm': minor
'@ts-linq/types': minor
'@ts-linq/sql-visitor': patch
'@ts-linq/dialect-postgres': minor
'@ts-linq/dialect-mssql': minor
'@ts-linq/dialect-mysql': minor
---

feat(p2-46): add MaxBatchSize support for SaveChanges batching

`DbContextOptionsBuilder.maxBatchSize(n)` enables multi-row INSERT/UPDATE/DELETE
batching in `saveChanges()`, reducing N round-trips to ceil(N/batchSize) calls.

- `@ts-linq/orm`: `DbContextOptionsBuilder.maxBatchSize()`, `BatchExecutor`, `BatchGrouper`
- `@ts-linq/types`: `BatchInsertResult`, `BatchUpdateResult` interfaces; extended `SqlDialect`
- `@ts-linq/sql-visitor`: `buildQuestionMarkRows`, `chunkArray`, `calcChunkSize` utilities
- `@ts-linq/dialect-postgres`: `buildPgBatchInsert/Update/Delete`, `PostgresOptionsBuilder`
- `@ts-linq/dialect-mssql`: `buildMssqlBatchInsert/Update/Delete`, `MssqlOptionsBuilder`
- `@ts-linq/dialect-mysql`: `buildMysqlBatchInsert/Update/Delete`, `MysqlOptionsBuilder`

PostgreSQL uses `INSERT ... RETURNING *` and CTE-based bulk UPDATE with type casts.
MSSQL uses `INSERT ... OUTPUT INSERTED` and VALUES-JOIN bulk UPDATE.
MySQL uses multi-row INSERT with `LAST_INSERT_ID()` for sequential PK assignment.
MySQL UPDATE falls back to per-row statements (no clean multi-row UPDATE syntax).
