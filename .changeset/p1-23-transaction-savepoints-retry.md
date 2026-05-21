---
"@ts-linq/orm": minor
"@ts-linq/concurrency": minor
"@ts-linq/core": minor
"@ts-linq/types": minor
"@ts-linq/provider-postgres": minor
"@ts-linq/provider-mysql": minor
"@ts-linq/provider-mssql": minor
---

feat(P1-23): add transaction savepoints and ExecutionStrategy (EnableRetryOnFailure)

Introduces first-class savepoint API and retry-on-failure execution strategy mirroring EF Core.

**New public APIs:**
- `context.database.beginTransactionAsync()` → `DbContextTransaction` with savepoint methods (`createSavepointAsync`, `rollbackToSavepointAsync`, `releaseSavepointAsync`, `commitAsync`, `rollbackAsync`) and `AsyncDisposable` support for `await using`
- `context.database.createExecutionStrategy()` → `ExecutionStrategy` with `executeAsync(fn)` for automatic transient-error retry with exponential backoff
- `DbContextOptionsBuilder.enableRetryOnFailure(options)` to configure retry behaviour
- `ExecutionStrategy` class exported from `@ts-linq/concurrency`
- `ExecutionStrategyOptions` interface in `@ts-linq/types`

**Provider enhancements:**
- `DatabaseProvider.createSavepoint/rollbackToSavepoint/releaseSavepoint` (ANSI SQL default; MSSQL uses `SAVE TRANSACTION` syntax)
- `DatabaseProvider.checkTransientError()` public facade over transient error classifier
- Dialect-specific transient error code lists for PostgreSQL (40P01, 40001…), MySQL (1213, 2013…), and SQL Server (1205, 1222…)

**Breaking changes:** none — all additions are backward compatible.
