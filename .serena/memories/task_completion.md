# Completed Tasks

## P0-01 — Fluent API ModelBuilder ✅
PR merged. OnModelCreating, ModelBuilder, EntityTypeBuilder<T>, IEntityTypeConfiguration<T>.

## P0-02 — AsNoTracking / AsTracking ✅
PR merged (feat/p0-02-as-no-tracking). QueryTrackingBehavior enum, AsNoTracking/AsTracking/AsNoTrackingWithIdentityResolution on DbSet and Queryable, ChangeTracker.queryTrackingBehavior.

## P0-03 — FromSqlInterpolated / FromSqlRaw / DatabaseFacade ✅
PR #87 merged (feat/p0-03-from-sql-interpolated).
- sql tagged template, SqlInterpolated class
- DbSet.fromSqlInterpolated / fromSqlRaw → Queryable with rawSqlSource
- ctx.database: DatabaseFacade (executeSqlInterpolated/Raw, sqlQuery/Raw)
- Derived-table wrapping: FROM (<sql>) AS t0
- rawSqlSource in QueryOptions/QueryModel/QueryBuilder/all 3 dialects
- formatSqlWithParams on DatabaseProvider
- 27 unit tests

## P0-12 — EF-style Interceptors ✅
Branch: feat/p0-12-interceptors. PR pending.

### New Files Created:
- `packages/core/src/interceptors/types.ts` — DbCommand, CommandEventData, DbReader, SaveChangesEntry, SaveChangesEventData, MaterializationInterceptionData, ConnectionEventData, TransactionEventData
- `packages/core/src/interceptors/InterceptionResult.ts` — SuppressWithResult<T> / NoResult<T> value class
- `packages/core/src/interceptors/IDbCommandInterceptor.ts` — readerExecuting?, readerExecuted?, nonQueryExecuting?, nonQueryExecuted?
- `packages/core/src/interceptors/ISaveChangesInterceptor.ts` — savingChanges?, savedChanges?, saveChangesFailed?
- `packages/core/src/interceptors/IMaterializationInterceptor.ts` — initializing?, initialized?
- `packages/core/src/interceptors/IDbConnectionInterceptor.ts` — connectionOpening?, connectionOpened?, connectionClosing?, connectionClosed?
- `packages/core/src/interceptors/IDbTransactionInterceptor.ts` — transactionStarting?, transactionStarted?, transactionCommitting?, transactionCommitted?, transactionRollingBack?, transactionRolledBack?
- `packages/core/src/interceptors/index.ts` — barrel
- `packages/orm/src/interceptors/InterceptorRegistry.ts` — duck-typing registry, isEmpty fast-path
- `packages/orm/src/DbContextOptionsBuilder.ts` — addInterceptors() fluent API
- `packages/orm/tests-new/interceptors.test.ts` — 24 unit tests

### Modified Files:
- `packages/core/src/types/index.ts` — added interceptors?: object[] to DbContextOptions
- `packages/core/src/index.ts` — exports InterceptionResult + 5 interfaces + event types
- `packages/core/src/DatabaseProvider.ts` — template-method pattern for connect/disconnect/transactions, interceptor notification helpers, configureInterceptors()
- `packages/orm/src/DbContext.ts` — InterceptorRegistry wired in constructor; saveChanges() wrapped with savingChanges/savedChanges/saveChangesFailed pipeline
- `packages/orm/src/services/AuditInterceptor.ts` — implements ISaveChangesInterceptor
- `packages/orm/src/services/SoftDeleteInterceptor.ts` — implements ISaveChangesInterceptor (pass-through)
- `packages/orm/src/index.ts` — exports DbContextOptionsBuilder, InterceptorRegistry
- `packages/provider-postgres/src/PostgresProvider.ts` — renamed to doConnect/doDisconnect/doBeginTransaction/doCommitTransaction/doRollbackTransaction
- `packages/provider-mysql/src/MySqlProvider.ts` — same renames
- `packages/provider-mssql/src/MssqlProvider.ts` — same renames
- All test stubs extended with doConnect/doDisconnect/doBeginTransaction/doCommitTransaction/doRollbackTransaction

### Key Architectural Decisions:
- Duck-typing guards using 'in' operator (works on prototype chain)
- InterceptorRegistry partitions at construction O(n) once, forEach*() returns cached arrays O(1)
- isEmpty fast-path avoids all iteration when no interceptors registered
- Template method pattern: concrete connect()/beginTransaction() wrap doConnect()/doBeginTransaction()
- AuditInterceptor.savingChanges() replaces direct apply() calls from DbContext
- savingChanges() pipeline runs BEFORE transaction opens; savedChanges() runs after commit
- InterceptionResult.SuppressWithResult(n) short-circuits saveChanges before DML
- ESLint naming-convention warns on I-prefix interfaces (acceptable for EF Core parity)

### Validation outcome:
- typecheck: 31/31 ✅
- lint: 0 errors ✅
- tests:unit: 147/147 suites, 1833 tests ✅
- test:integration: 31/31 ✅
- test:e2e: infrastructure failures (no DB servers) — pre-existing, confirmed identical to main ✅
- build: 32/32 ✅
- arch:deps: no violations ✅
- arch:cycles: no cycles ✅
- arch:dead: clean ✅

## Next P0 tasks
- P0-04: ExecuteUpdate / ExecuteDelete (depends on P0-03 — unblocked)
- P0-05: Value converters (depends on P0-01)
- P0-06 through P0-15: Other EF Core parity tasks
