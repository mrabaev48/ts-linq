---
'@ts-linq/query': minor
'@ts-linq/types': minor
'@ts-linq/orm': minor
'@ts-linq/dialect-postgres': minor
'@ts-linq/dialect-mssql': minor
'@ts-linq/dialect-mysql': minor
'@ts-linq/testkits': patch
---

feat(p0-04): add ExecuteUpdate and ExecuteDelete bulk DML (EF Core parity)

`Queryable<T>` and `DbSet<T>` now expose `executeUpdate()` and `executeDelete()` — single-statement
bulk DML that bypasses the change tracker, mirroring EF Core 7's `ExecuteUpdateAsync` / `ExecuteDeleteAsync`.

- `@ts-linq/types`: `SetterSpec`, `BulkUpdateContext`, `BulkDeleteContext` interfaces;
  `buildBulkUpdate?` and `buildBulkDelete?` added to `SqlDialect`
- `@ts-linq/query`: `ISetPropertyCalls<T>`, `SetPropertyCalls<T>`;
  `Queryable.executeUpdate()` and `Queryable.executeDelete()` terminal methods
- `@ts-linq/orm`: `DbSet.executeUpdate()` and `DbSet.executeDelete()` delegation methods
- `@ts-linq/dialect-postgres`: `buildBulkUpdate` / `buildBulkDelete` with `$N` placeholders
- `@ts-linq/dialect-mssql`: `buildBulkUpdate` / `buildBulkDelete` with `@pN` placeholders
- `@ts-linq/dialect-mysql`: `buildBulkUpdate` / `buildBulkDelete` with `?` placeholders
- `@ts-linq/testkits`: `TestDialect.buildBulkUpdate` / `buildBulkDelete` for test assertions

Supports literal values and column-reference copies. Throws a descriptive error when
`include()` is chained before bulk DML (eager loading is not supported in this path).
ChangeTracker staleness is documented — callers should reload affected entities if needed.
