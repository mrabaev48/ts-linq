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

## Next P0 tasks
- P0-04: ExecuteUpdate / ExecuteDelete (depends on P0-03 — now unblocked)
- P0-05: Value converters (depends on P0-01)
- P0-12: Interceptors
