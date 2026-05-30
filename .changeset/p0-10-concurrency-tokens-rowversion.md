---
'@ts-linq/orm': minor
'@ts-linq/types': minor
'@ts-linq/core': patch
'@ts-linq/dialect-postgres': patch
'@ts-linq/dialect-mysql': patch
'@ts-linq/dialect-mssql': patch
'@ts-linq/provider-postgres': patch
'@ts-linq/provider-mysql': patch
'@ts-linq/provider-mssql': patch
---

feat(p0-10): implement concurrency tokens, RowVersion, and DbUpdateConcurrencyException

- `PropertyBuilder.isConcurrencyToken()` and `isRowVersion()` fluent API methods
- `ColumnMetadata.isConcurrencyToken` flag in `@ts-linq/types`
- `DbUpdateConcurrencyException` with populated `entries: EntityEntry[]`
- `EntityEntry.reload()` and `getDatabaseValues()` recovery helpers
- WHERE-clause injection of original token values in UPDATE/DELETE for all three dialects (postgres, mysql, mssql)
- `originalValues` propagated from ChangeTracker snapshot through the full save pipeline
- `OptimisticConcurrencyError` re-thrown as `DbUpdateConcurrencyException` in `saveChanges()`
