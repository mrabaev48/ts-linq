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
 - [done] Predicate→SQL cache for where() with eviction
 - [done] Precompiled regexes and caches for selector/include/key parsing
 - [done] Faster count cache key via incremental where signature
 - [done] Micro-benchmark script with avg/p95/p99 output (npm run bench)

## Reliability & Errors
- [done] Optional Result<T, E> for non-exceptional flows; centralize error mapping
- [done] Central SQL logger with timings, parameters (safe), transaction trace ids
- [done] Safer predicate parser: guard rails and deterministic fallbacks
- [done] Provider error mapping across dialects: Unique/FK/timeout (SQLite, Postgres, MySQL, MSSQL)
- [done] Retry policy with backoff+jitter; no-retry inside explicit transaction

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
- [done] Caching: L2 cache (hit/update/invalidate), count() TTL cache, paginate/keysetPaginate
- [done] Retry policy tests (with/without transaction)
- [done] Middleware tests: entityMaterialized, before/after with traceId and rows
- [done] Error mapping tests: SQLite, Postgres, MySQL, MSSQL (unique/FK/timeout)

## Documentation & Tooling
- [done] Typedoc API reference from JSDoc
- [done] Guides: anti-N+1 include (batching), custom dialect strategy, specs examples
- [done] Add playground examples: dynamic filters, include-first chaining, joins
 - [done] Update README with try-methods, SqlLogger, and QueryBuilder cache utilities
- [done] Guide: test-matrix (env vars, Docker quickstart, Testcontainers plan)

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
- [P3] Migration generator: schema diff from metadata → safe migrations (ALTER with guards) [done]
- [P2] Caching: stronger L2 cache with transaction-aware invalidation; shared SQL/AST cache [done]
- [P1] Resilience: retry policy (idempotent ops only), jitter, circuit breaker [done]
- [P2] Tracing/metrics: OpenTelemetry integration, Prometheus metrics, traceId correlation
  - [done] OpenTelemetry integration
  - [done] traceId correlation in SQL logger and middleware
  - [done] Prometheus metrics (PrometheusSqlLogger + tests + README)

### Prometheus Metrics (separate task)
- [P2] Prometheus metrics integration
  - Metrics export:
    - [done] Expose optional `/metrics` endpoint helper (using `prom-client` when present)
    - [done] Provide `PrometheusSqlLogger` to emit metrics without endpoint coupling
  - Metrics set (names tentative):
    - [done] `db_query_total` (counter) — labels: provider, operation, entity, success
    - [done] `db_query_duration_ms` (histogram) — labels: provider, operation, entity, success; sensible buckets
    - [done] `db_error_total` (counter) — labels: provider, operation, error_type
    - [done] `db_retry_total` (counter) — labels: provider, operation
    - [done] `db_active_transactions` (gauge)
    - [done] `db_cache_hits_total` / `db_cache_misses_total` (counters) — labels: cache=sqlGen|entityL2|count
  - Label schema & exemplars:
    - [done] Standardize labels (low-cardinality): provider, operation (select/insert/update/delete/count), entity
    - [done] Attach traceId as exemplar when available (if supported by `prom-client` version)
  - Configuration:
    - [done] `prefix`, `bucketsMs`, DI of existing Prometheus client; no hard dependency
  - Tests:
    - [done] Unit tests for counters/histograms increments via logger hooks
    - [done] Integration test: lightweight HTTP server, assert `/metrics` returns body
  - Documentation:
    - [done] README: setup with Node/Express/Fastify (example), notes on optional prom-client
    - [done] Add dashboards hints and example PromQL; guidance on bucket tuning and label cardinality limits
- [P2] Identifier quoting: centralized quoting via SqlDialect for table/column names [done]
- [P2] Extended LINQ: groupBy/having [done]; subqueries (exists/in) [done], unions [done]
- [P2] Model validation: declarative rules checked before saveChanges [done]
- [P1] Pagination: keyset pagination and paginate(page,size) helper with total/TTL cache [done]
- [P2] Soft delete & audit: soft-delete flag, createdAt/updatedAt/createdBy/updatedBy hooks [done]
- [P3] Multi-tenancy: tenant scoping and default filters at DbContext level [done]
- [P2] Plugin/middleware API: hooks before/after materialization and execute [done]
- [P2] Documentation: guides for diff-migrations, upsert/batch, advanced include/join [ongoing]; README: Pagination & Optimistic Concurrency [done]
  - [done] Export PrometheusEndpoint helpers in public API

## Snapshot tests (deferred)

- Добавить снапшот-тесты для полного SQL миграций (несколько таблиц/индексов/FK)
- Зафиксировать формат/порядок вывода перед релизом
- Использовать как канареек для регрессий форматирования

## CLI (deferred to the end)

- [P3] CLI tooling: init, generate entity/migration, migrate/rollback, seed
- Detailed plan: see `cli-plans.md`

## Test matrix (deferred)

- Testcontainers-based integration for all providers in CI
- Property-based tests for join/include

## Distribution (after CLI)

- ESM/CJS builds, tree-shaking, types, changelog, semver releases
