# Improvement Plans

## Architecture & OOP
- [done] Introduce SQL Dialect Strategy (SQLiteStrategy, PostgresStrategy, MySQLStrategy) and inject into QueryBuilder
- [done] Predicate → AST + Visitor: parse where/select/join into AST; generate SQL via Visitor per dialect (minimal for where)
- [done] Specification pattern for reusable filters (composable specs with toSql()/test())
- [done] Query Object: keep intent (AST/options) separate from execution/mapping services (QueryModel)
- [done] Template Method in providers for connection/execute/map hooks

## Clean Code & Typing
- [done] Remove all implicit any, add strict types for EntityLoader, DbSetWithIncludes, include lists, AST nodes
- [done] Mark read-only data (metadata, options snapshots) as immutable; return new objects when chaining
- [done] Replace operator strings with enums (ComparisonOperator, LogicalOperator)
- [done] Extract long methods in Queryable into small private helpers
- [done] Strengthen JSDoc with parameter/return types and invariants

## Performance
- [done] Anti N+1: batch one-to-many loading using IN queries per relation (per request)
- [done] Add per-query SQL generation cache (hash of options → {query, params})
- [done] Level-2 cache for row→entity mapping (optional, behind flag)
- [done] Optional pagination total count optimization (COUNT window caching)

## Reliability & Errors
- [done] Optional Result<T, E> for non-exceptional flows; centralize error mapping
- [done] Central SQL logger with timings, parameters (safe), transaction trace ids
- [done] Safer predicate parser: guard rails and deterministic fallbacks

## API & DX
- [done] Validate include names against metadata; descriptive errors
- [done] Configurable default depth and strategy at DbContext level; override per call
- [done] Add typed join helpers: innerJoin/leftJoin with selectors
- [done] Provide cancelable/abortable query execution (AbortSignal)

## Testing
- [done] Unit: AST builder, SQL visitor, predicate parser
- [done] Integration: providers contract tests shared across dialects
- [done] Property-based tests (fast-check) for predicate equivalence
- [done] Performance regression tests for include batching

## Documentation & Tooling
- [done] Typedoc API reference from JSDoc
- [done] Guides: anti-N+1 include (batching), custom dialect strategy, specs examples
- [done] Add playground examples: dynamic filters, include-first chaining, joins
 - [done] Update README with try-methods, SqlLogger, and QueryBuilder cache utilities

## Near-term actionable items
- [done] Implement include batching (one-to-many via IN) in EntityLoader
- [done] Introduce ComparisonOperator enum and refactor parser to use it internally
- [done] Add SQL generation cache in QueryBuilder (simple Map with option hash)
- [done] Validate includes at runtime against metadata and throw clear errors
- [done] Add unit tests for new enum + parser paths, and integration tests for batched includes

## Future Work

### PostgreSQL Support
- [done] PostgreSQLDialect: implement SqlDialect for Postgres specifics (identifiers, LIMIT/OFFSET, JOINs)
- [done] PostgreSQLProvider: provider based on `pg` with connection pool (lazy dep)
- [done] Parameter style: switch to $1..$n placeholders in generated SQL
- [done] IN / ANY: implement findWhereIn via `= ANY($1)` with array parameters
- Types mapping: UUID, JSONB, TIMESTAMPTZ, arrays; value conversions
- [done] Types mapping: UUID, JSONB, TIMESTAMPTZ, arrays; value conversions
- DDL & migrations: table/index creation with quoted identifiers and IF NOT EXISTS
- [done] DDL & migrations: table/index creation with quoted identifiers and IF NOT EXISTS
- [done] DbContext: add 'postgresql' provider option and wiring
- Testing: integration tests gated by env POSTGRES_URL; CI matrix
- [done] Docs: README section with installation, config, and dialect differences
- Examples: runnable example using Postgres and docker-compose snippet
- [done] Examples: runnable example using Postgres

### Microsoft SQL Server (MSSQL) Support
- [done] MssqlDialect: implement SqlDialect for T-SQL specifics (identifiers in [brackets], TOP/OFFSET FETCH)
- [done] Parameter style: switch to @p1..@pn placeholders in generated SQL
- [done] MssqlProvider: provider based on `mssql` (tedious) with connection pool
- [done] Types mapping: UNIQUEIDENTIFIER, NVARCHAR(MAX), VARBINARY(MAX), BIT, DATETIME2, DECIMAL
- [done] IN with table-valued or classic IN list; WHERE IN batching
- [done] DDL & migrations: table/index creation with IF NOT EXISTS and schema support
- [done] DbContext: add 'mssql' provider option and wiring
- [done] Testing: integration tests gated by env MSSQL_URL; CI matrix (docker `mcr.microsoft.com/mssql/server`)
- [done] Docs: README section with installation, config, and dialect differences
- [done] Examples: runnable example using MSSQL and docker-compose snippet

### MySQL Support
- [done] MysqlDialect: implement SqlDialect for MySQL specifics (identifiers `\`name\``, LIMIT/OFFSET)
- [done] MySqlProvider: provider based on `mysql2/promise` with pool
- [done] Types mapping: VARCHAR/TEXT, INT, DOUBLE, TINYINT(1)→boolean, DATETIME, BLOB
- [done] DDL & migrations: table/index creation with IF NOT EXISTS and backticks
- [done] DbContext: add 'mysql' provider option and wiring
- [done] Testing: integration tests gated by env MYSQL_URL; CI matrix
- [done] Docs: README section with installation, config, and dialect differences
- [done] Examples: runnable example using MySQL and docker-compose snippet

## Further Improvements (Prioritized)

- [P1] Upsert/Batch operations: insertMany, updateMany, upsert (ON CONFLICT/ON DUPLICATE KEY/MERGE) [done]
- [P2] Optimistic concurrency: version columns (rowversion/xmin/timestamp) and checks on update/delete [done]
- [P3] Migration generator: schema diff from metadata → safe migrations (ALTER with guards)
- [P3] CLI tooling: init, generate entity/migration, migrate/rollback, seed
- [P2] Caching: stronger L2 cache with transaction-aware invalidation; shared SQL/AST cache
- [P1] Resilience: retry policy (idempotent ops only), jitter, circuit breaker [done]
- [P2] Tracing/metrics: OpenTelemetry integration, Prometheus metrics, traceId correlation
- [P2] Identifier quoting: centralized quoting via SqlDialect for table/column names
- [P2] Extended LINQ: groupBy/having, subqueries (exists/in), unions
- [P2] Model validation: declarative rules checked before saveChanges
- [P1] Pagination: keyset pagination and paginate(page,size) helper with total/TTL cache [done]
- [P2] Soft delete & audit: soft-delete flag, createdAt/updatedAt/createdBy/updatedBy hooks
- [P3] Multi-tenancy: tenant scoping and default filters at DbContext level
- [P2] Plugin/middleware API: hooks before/after materialization and execute
- [P2] Documentation: guides for diff-migrations, upsert/batch, advanced include/join [ongoing]
- [P2] Test matrix: Testcontainers-based integration for all providers in CI; property-based tests for join/include
- [P2] Distribution: ESM/CJS builds, tree-shaking, types, changelog, semver releases
