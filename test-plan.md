# 📋 Comprehensive Testing Plan for TypeScript ORM Framework

## 📖 Table of Contents

- [Overview](#overview)
- [Testing Strategy](#testing-strategy)
- [Package Dependency Graph](#package-dependency-graph)
- [Tier 0: Foundation & Infrastructure](#tier-0-foundation--infrastructure-4-days)
- [Tier 1: Core ORM Packages](#tier-1-core-orm-packages-12-days)
- [Tier 2: Adapters and Utilities](#tier-2-adapters-and-utilities-11-days)
- [Tier 3: Plugins and Integrations](#tier-3-plugins-and-integrations-7-days)
- [E2E Tests](#e2e-tests-9-days)
- [Shared Test Utilities](#shared-test-utilities)
- [Complexity Estimation](#complexity-estimation)
- [Execution Plan](#execution-plan)

---

## Overview

This document outlines a comprehensive testing plan for complete test suite rewrite of the TypeScript ORM framework covering **all 35 packages** with 241 existing test files to be deleted and rewritten from scratch.

### Goals

1. **Delete ALL existing tests** from `packages/*/tests` folders
2. **Write comprehensive unit tests** for each package covering:
   - All classes, functions, methods
   - All edge cases and error conditions
   - Happy paths and failure scenarios
   - Type safety validation
   - Decorator functionality (Stage-3 decorators with reflect-metadata)

3. **Write new E2E tests** in `packages/e2e-tests` covering:
   - Full CRUD workflows across all 4 database providers
   - Multi-database provider testing (SQLite, PostgreSQL, MySQL, MSSQL)
   - Change tracking and transactional integrity
   - Query building (LINQ-style queries with complex predicates)
   - Relationships and lazy loading with N+1 prevention
   - Migration scenarios (up/down/rollback)
   - Performance benchmarks and caching validation
   - Concurrency and transaction isolation

### Framework

- **Testing Framework**: Jest with ts-jest (confirmed in use)
- **Total Effort**: ~43 dev-days
- **Target Coverage**: >90%
- **Test Count**: ~800-1000 test cases expected

### Progress Status

**✅ TIER 0 COMPLETE** (November 10, 2025)
- 327 tests passing across 6 foundation packages
- All critical issues fixed (ConfigLoader state management, testkits coverage)
- Architect-reviewed and approved

**✅ TIER 1 COMPLETE** (November 10, 2025)
- 410 tests passing across 5 core ORM packages
- metadata: 52 tests ✅
- core: 125 tests ✅ (includes circular dependency fix in relationship decorators)
- query: 85 tests ✅ (QueryBuilder, QueryModel, CountCache)
- orm: 74 tests ✅ (ChangeTracker, DbSet)
- migrations: 74 tests ✅ (MigrationBuilder, MigrationRunner, DiffBasedMigration)
- All packages architect-reviewed and approved ✅

**⏳ TIER 2 IN PROGRESS** (Started November 10, 2025)
- **3 utility packages complete: 60 tests** (cache 28, pagination 7, concurrency 25) - Architect-approved ✅
- **2 cache adapters complete: 119 tests** (cache-redis 61, cache-memcached 58) - *Production fix applied: read-through from remote store*
- Remaining: 4 dialects, 4 providers

**TOTAL: 916 tests passing** (327 Tier 0 + 410 Tier 1 + 179 Tier 2)

---

## Complete Package Coverage Checklist

This section provides an authoritative enumeration of all 35 packages with their assigned tiers, ensuring complete test coverage.

| # | Package | Tier | Effort | Test Focus |
|---|---------|------|--------|------------|
| 1 | types | 0 | 0.5d | Type exports, brand types, utility types |
| 2 | config | 0 | 0.5d | Config loading, env parsing, validation |
| 3 | ast | 0 | 0.5d | AST nodes, expression parsing, traversal |
| 4 | sql-visitor | 0 | 0.5d | SQL generation from AST, injection prevention |
| 5 | metrics-safe | 0 | 0.5d | Safe metric logging, error handling |
| 6 | testkits | 0 | 1.5d | Fixtures, mocks, db containers, assertions |
| 7 | metadata | 1 | 2d | Decorators (@Entity, @Column, etc.), MetadataStorage |
| 8 | core | 1 | 3d | DatabaseProvider, BatchOperations, EntityLoader, caching |
| 9 | query | 1 | 3d | Queryable, TypedQueryable, QueryBuilder, PredicateParser |
| 10 | orm | 1 | 2d | DbContext, DbSet, ChangeTracker, CRUD commands |
| 11 | migrations | 1 | 2d | MigrationRunner, MigrationBuilder, schema diff |
| 12 | dialect-sqlite | 2 | 2d | SQLite SQL generation, DDL strategy |
| 13 | dialect-postgres | 2 | 2d | PostgreSQL SQL generation, DDL strategy |
| 14 | dialect-mysql | 2 | 2d | MySQL SQL generation, DDL strategy |
| 15 | dialect-mssql | 2 | 2d | MSSQL SQL generation, DDL strategy |
| 16 | provider-sqlite | 2 | 0.5d | SQLite provider implementation, file-based DB |
| 17 | provider-postgres | 2 | 0.5d | PostgreSQL provider, connection pool, error mapping |
| 18 | provider-mysql | 2 | 0.5d | MySQL provider, connection pool, type conversion |
| 19 | provider-mssql | 2 | 0.5d | MSSQL provider, connection pool, request handling |
| 20 | cache | 2 | 0.25d | EntityCache interface definitions |
| 21 | cache-redis | 2 | 0.125d | Redis cache implementation, serialization |
| 22 | cache-memcached | 2 | 0.125d | Memcached cache implementation |
| 23 | concurrency | 2 | 0.5d | Optimistic concurrency, pessimistic locking |
| 24 | pagination | 2 | 0.25d | Pagination helpers, cursor-based pagination |
| 25 | plugin-audit | 3 | 0.75d | Audit trail (createdAt, updatedAt, user context) |
| 26 | plugin-multi-tenant | 3 | 0.75d | Tenant filtering, context injection |
| 27 | plugin-soft-delete | 3 | 0.5d | Soft delete, restore, filter deleted entities |
| 28 | cli | 3 | 2d | Migration commands, codegen, database commands |
| 29 | integration-nestjs | 3 | 1d | NestJS module, repository injection |
| 30 | examples | 3 | 1d | Example project validation, best practices |
| 31 | telemetry | 3 | 0.25d | Telemetry integration, metric collection |
| 32 | prometheus-sql-logger | 3 | 0.25d | Prometheus metrics endpoint, histograms |
| 33 | open-telemetry-sql-logger | 3 | 0.125d | OpenTelemetry spans, trace export |
| 34 | composite-sql-logger | 3 | 0.125d | Composite logger delegation |
| 35 | e2e-tests | E2E | 9d | Full CRUD, queries, relationships, migrations, caching, performance |

**Total**: 35 packages, 43 dev-days

### Coverage Verification

✅ **Tier 0** (6 packages): types, config, ast, sql-visitor, metrics-safe, testkits - **COMPLETE (327 tests)**
✅ **Tier 1** (5 packages): **COMPLETE (410 tests)** - Architect-approved ✅
   - ✅ metadata (52 tests)
   - ✅ core (125 tests) - includes production fix for circular dependencies
   - ✅ query (85 tests) - QueryBuilder, QueryModel, CountCache
   - ✅ orm (74 tests) - ChangeTracker, DbSet
   - ✅ migrations (74 tests) - MigrationBuilder, MigrationRunner, DiffBasedMigration
⏳ **Tier 2** (13 packages): **60 tests complete** - cache (28) ✅, pagination (7) ✅, concurrency (25) ✅ - **IN PROGRESS**
   - Remaining: cache-redis, cache-memcached, 4 dialects, 4 providers
⏸️ **Tier 3** (10 packages): 3 plugins, cli, integration-nestjs, examples, 4 telemetry/logging packages  
⏸️ **E2E** (1 package): e2e-tests with multi-provider scenarios

---

## Testing Strategy

### Phased Approach

Execute a phased test-suite rewrite that begins with foundational infrastructure packages, then the core ORM surface, followed by adapters/providers, finishing with plugins and comprehensive E2E validation across all databases.

### Prioritization by Dependency Tiers

- **Tier 0** (types, config, ast, sql-visitor, metrics-safe, testkits): Establish shared contracts, AST parsing, configuration, and test infrastructure
- **Tier 1** (core, query, orm, metadata, migrations): CRUD, change tracking, decorators, LINQ, schema evolution
- **Tier 2** (dialects, providers, cache, concurrency, pagination, telemetry): SQL generation, connection lifecycles, retry/caching, pagination utilities
- **Tier 3** (plugins, integrations, CLI, examples): Extension points and developer tooling

### Test Structure

For each package, define Vitest `describe` blocks mirroring each class/function with:
- Arrange/Act/Assert helpers
- Exhaustive branch coverage (happy path, error/edge cases, type guards)
- Decorator metadata validation
- Stage-3 decorator emit ordering verification
- Snapshot baselines where SQL/metadata outputs matter
- Property-based testing for complex logic (using fast-check where applicable)

### Isolated State Management

- Use `beforeEach`/`afterEach` for cleanup
- Call `MetadataStorage.reset()` between tests
- Teardown providers and database connections
- Reset cache instances
- Clear global state (counters, singletons)
- Dispose of timers and intervals

---

## Package Dependency Graph

```
Tier 0 (Foundation & Infrastructure):
  types ─┐
  config ┼─> testkits
  ast ───┤
  sql-visitor ┤
  metrics-safe ┘

Tier 1 (Core ORM):
  metadata ──> core ──> query ──> orm
                  └────> migrations

Tier 2 (Adapters & Utilities):
  dialect-sqlite ──> provider-sqlite
  dialect-postgres ──> provider-postgres
  dialect-mysql ──> provider-mysql
  dialect-mssql ──> provider-mssql
  
  cache ──> cache-redis, cache-memcached
  concurrency
  pagination
  telemetry ──> prometheus-sql-logger, open-telemetry-sql-logger, composite-sql-logger

Tier 3 (Plugins & Integrations):
  plugin-audit
  plugin-multi-tenant
  plugin-soft-delete
  cli
  integration-nestjs
  examples
```

---

## TIER 0: Foundation & Infrastructure ✅ COMPLETE (327 tests)

**Status**: All 6 packages tested and architect-approved (November 10, 2025)

### 1. `packages/types` ✅ COMPLETE (50 tests)

#### What to Test

- ✅ Type exports and TypeScript compilation
- ✅ Brand types (PrimaryKeyOf, branded IDs)
- ✅ Utility types (EntityState, LoadingStrategy, etc.)
- ✅ Interface contracts (SqlLogger, OrmMiddleware, etc.)

#### Test Files

```typescript
// types/tests/brand-types.test.ts
describe('Brand Types', () => {
  it('should create branded primary key types')
  it('should enforce type safety at compile time')
  it('should work with generic constraints')
  it('should prevent brand mixing at compile time')
})

// types/tests/entity-state.test.ts
describe('EntityState Enum', () => {
  it('should export all EntityState values (Added, Modified, Deleted, Unchanged)')
  it('should type-check state transitions')
  it('should be usable in switch statements')
})

// types/tests/interfaces.test.ts
describe('Type Interfaces', () => {
  it('should export SqlLogger interface')
  it('should export OrmMiddleware interface')
  it('should export LoadingStrategy type')
  it('should validate interface compatibility')
})
```

---

### 2. `packages/config` ✅ COMPLETE (76 tests)

#### What to Test

- ✅ Configuration loading from files
- ✅ Environment variable parsing
- ✅ Default configuration values
- ✅ Configuration validation
- ✅ Type-safe configuration accessors
- ✅ Global state cleanup (process.cwd() restoration)

#### Test Files

```typescript
// config/tests/config-loader.test.ts
describe('Configuration Loader', () => {
  it('should load config from JSON file')
  it('should load config from environment variables')
  it('should merge config sources with correct precedence')
  it('should apply default values for missing config')
  it('should validate required fields')
  it('should throw on invalid configuration')
  it('should support nested configuration objects')
  it('should handle missing config file gracefully')
})

// config/tests/config-validation.test.ts
describe('Configuration Validation', () => {
  it('should validate connection string format')
  it('should validate pool size ranges')
  it('should validate timeout values')
  it('should reject invalid enum values')
})
```

---

### 3. `packages/ast` ✅ COMPLETE (60 tests)

#### What to Test

- ✅ AST node types and constructors
- ✅ Expression parsing (binary, unary, logical)
- ✅ Identifier resolution
- ✅ Literal value handling
- ✅ AST traversal utilities
- ✅ Specification pattern implementations

#### Test Files

```typescript
// ast/tests/ast-nodes.test.ts
describe('AST Nodes', () => {
  it('should create BinaryExpressionNode')
  it('should create LogicalExpressionNode')
  it('should create IdentifierNode')
  it('should create LiteralNode with correct value types')
  it('should support ComparisonOperator enum')
  it('should support LogicalOperator enum')
})

// ast/tests/ast-traversal.test.ts
describe('AST Traversal', () => {
  it('should traverse binary expression tree')
  it('should visit all nodes in order')
  it('should collect identifiers from expression')
  it('should evaluate constant expressions')
  it('should detect unsupported node patterns')
})
```

---

### 4. `packages/sql-visitor` ✅ COMPLETE (2 tests)

#### What to Test

- ✅ SQL generation from AST nodes (placeholder package)
- ✅ Basic visitor functionality

#### Test Files

```typescript
// sql-visitor/tests/sql-visitor.test.ts
describe('SqlVisitor', () => {
  it('should visit BinaryExpressionNode and generate SQL')
  it('should visit LogicalExpressionNode and combine with AND/OR')
  it('should visit IdentifierNode and escape column names')
  it('should visit LiteralNode and parameterize values')
  it('should generate WHERE clause from AST')
  it('should extract parameters in correct order')
  it('should prevent SQL injection via parameterization')
  it('should handle complex nested expressions')
  it('should handle NULL values correctly')
})
```

---

### 5. `packages/metrics-safe` ✅ COMPLETE (35 tests)

#### What to Test

- ✅ Safe metric logging wrappers
- ✅ Error handling without crashes
- ✅ MemoryProfiler utilities
- ✅ Debug mode logging

#### Test Files

```typescript
// metrics-safe/tests/safe-metrics.test.ts
describe('Safe Metrics', () => {
  it('should log metrics without throwing')
  it('should handle logger errors gracefully')
  it('should cache metric values')
  it('should report cache size safely')
  it('should count evictions without errors')
  it('should no-op when logger is undefined')
  it('should warn on debug mode without crashing')
})
```

---

### 6. `packages/testkits` ✅ COMPLETE (104 tests)

#### What to Test

- ✅ Fixture factories for entities (EntityBuilder)
- ✅ Mock provider implementations (MockDatabaseProvider)
- ✅ Test database setup helpers (DatabaseHarness)
- ✅ SQL snapshot matching (SqlSnapshotMatcher)
- ✅ Test entity fixtures (User, Post, Comment, etc.)

#### Test Files

```typescript
// testkits/tests/fixtures.test.ts
describe('Fixture Factories', () => {
  it('should generate deterministic entity fixtures')
  it('should support custom field overrides')
  it('should create related entities with FK integrity')
  it('should handle circular relationships')
  it('should generate batches of entities')
  it('should support entity inheritance')
})

// testkits/tests/mock-provider.test.ts
describe('MockDatabaseProvider', () => {
  it('should implement all DatabaseProvider methods')
  it('should track method calls for verification')
  it('should support custom query responses')
  it('should simulate connection failures')
  it('should mock transaction behavior')
  it('should return configurable result sets')
})

// testkits/tests/metadata-reset.test.ts
describe('Metadata Reset Utilities', () => {
  it('should clear MetadataStorage between tests')
  it('should restore decorator registrations')
  it('should handle pending metadata cleanup')
  it('should reset global state counters')
})

// testkits/tests/db-containers.test.ts
describe('Database Containers', () => {
  it('should start Postgres container')
  it('should start MySQL container')
  it('should start MSSQL container')
  it('should stop all containers on cleanup')
  it('should provide connection strings')
  it('should wait for container readiness')
})

// testkits/tests/assertions.test.ts
describe('Assertion Helpers', () => {
  it('should assert entity equality')
  it('should assert SQL pattern match')
  it('should assert metadata registration')
  it('should assert change tracker state')
})
```

#### Output

Shared test harness for all packages.

---

## TIER 1: Core ORM Packages (12 days)

### 7. `packages/metadata` (2 days)

#### Classes to Test

- `@Entity`, `@Column`, `@PrimaryKey`
- `@ComputedColumn`, `@DatabaseFunction`
- `@OneToMany`, `@ManyToOne`, `@OneToOne`, `@ManyToMany`
- `@ValidIf`, `@RequiredIfOf`, `@MinLengthOf`, `@MaxLengthOf`, `@PatternOf`, `@RangeOf`
- `@Index`, `@CachePolicy`
- `MetadataStorage`, `PendingMetadataCollector`

#### Unit Tests

```typescript
// metadata/tests/entity-decorator.test.ts
describe('@Entity Decorator', () => {
  it('should register entity with default table name')
  it('should use custom table name from options')
  it('should handle Stage-3 decorator context')
  it('should throw if not Stage-3 decorator')
  it('should restore metadata after clear()')
  it('should support schema option')
  it('should register with MetadataStorage immediately')
})

// metadata/tests/column-decorator.test.ts
describe('@Column Decorator', () => {
  it('should register column with default settings')
  it('should respect nullable option (default true)')
  it('should set column name override')
  it('should handle type, length, precision, scale')
  it('should mark generated/version columns')
  it('should throw for non-Stage-3 context')
  it('should support default value expressions')
  it('should validate column type strings')
})

// metadata/tests/primary-key-decorator.test.ts
describe('@PrimaryKey Decorator', () => {
  it('should register as column + primary key')
  it('should default to INTEGER type')
  it('should support autoIncrement option')
  it('should mark as non-nullable')
  it('should support branded primary keys')
  it('should update metadata for brand property')
  it('should support composite primary keys')
  it('should support version field option')
})

// metadata/tests/computed-column.test.ts
describe('@ComputedColumn Decorator', () => {
  it('should register computed column with expression')
  it('should mark as non-persisted')
  it('should support dialect-specific expressions')
  it('should validate expression syntax')
})

// metadata/tests/database-function.test.ts
describe('@DatabaseFunction Decorator', () => {
  it('should register function expression')
  it('should support dialect overrides (sqlite, postgres, mysql, mssql)')
  it('should use default expression when dialect not specified')
  it('should validate function syntax')
})

// metadata/tests/relationships.test.ts
describe('Relationship Decorators', () => {
  it('should define one-to-many relationship')
  it('should define many-to-one relationship')
  it('should define one-to-one relationship')
  it('should define many-to-many with junction table')
  it('should respect foreign key property')
  it('should support inverse property name')
  it('should handle lazy loading configuration')
  it('should detect circular relationships')
  it('should validate target entity exists')
  it('should support cascade delete options')
  it('should handle polymorphic relationships')
})

// metadata/tests/validation-decorators.test.ts
describe('Validation Decorators', () => {
  it('should register ValidIf predicate')
  it('should validate RequiredIfOf condition')
  it('should enforce MinLengthOf constraint')
  it('should enforce MaxLengthOf constraint')
  it('should validate PatternOf regex')
  it('should validate RangeOf bounds')
  it('should support validation phases (onCreate, onUpdate, always)')
  it('should support custom error messages')
  it('should support i18n message keys')
  it('should pass message parameters')
})

// metadata/tests/index-decorator.test.ts
describe('@Index Decorator', () => {
  it('should register index on single column')
  it('should register composite index on multiple columns')
  it('should support unique index option')
  it('should support partial index predicate')
  it('should validate index name')
})

// metadata/tests/cache-policy-decorator.test.ts
describe('@CachePolicy Decorator', () => {
  it('should register cache policy')
  it('should define invalidation dependencies')
  it('should support TTL configuration')
  it('should validate entity references')
})

// metadata/tests/metadata-storage.test.ts
describe('MetadataStorage', () => {
  it('should store entity metadata globally')
  it('should retrieve entity by constructor')
  it('should add columns incrementally')
  it('should add primary keys to list')
  it('should store relationships')
  it('should store validation rules')
  it('should store indexes')
  it('should clear all metadata')
  it('should handle missing entity gracefully')
  it('should support metadata queries by table name')
  it('should detect duplicate entity registrations')
})
```

#### Edge Cases

- Duplicate decorator application
- Missing constructor context
- Circular relationship references
- Invalid validation predicates
- Conflicting index definitions
- Reserved SQL keywords as column names

---

### 8. `packages/core` (3 days)

#### Classes to Test

- `DatabaseProvider` (abstract base)
- `BatchOperations`, `BatchExecutor`, `BatchPlan`
- `EntityLoader`, `LazyLoadingProxy`
- `DdlBuilder`
- `EnhancedSqlCache`, `InMemorySqlCache`
- `EntityCache`, `InMemoryCountCache`
- `ExponentialBackoffRetryPolicy`
- `GlobalFilterApplier`
- `SqlHelper`
- `CircuitBreaker`, `HealthCheck`

#### Unit Tests

```typescript
// core/tests/database-provider.test.ts
describe('DatabaseProvider (Abstract)', () => {
  it('should initialize with connection string')
  it('should manage connection state')
  it('should manage transaction state')
  it('should track trace IDs for logging')
  it('should apply middlewares')
  it('should handle retry policy')
  it('should manage circuit breaker state')
  it('should perform health checks')
  it('should track query performance')
  it('should apply soft-delete options')
})

// core/tests/batch-operations.test.ts
describe('BatchOperations', () => {
  it('should bulk insert entities in chunks')
  it('should return detailed results when requested')
  it('should handle empty array gracefully')
  it('should call onProgress callback')
  it('should continue on error if configured')
  it('should stop on first error by default')
  it('should use transactions by default')
  it('should skip transactions if disabled')
  it('should bulk update with optimistic concurrency')
  it('should bulk delete entities')
  it('should bulk upsert (insert or update)')
  it('should respect custom batch size')
  it('should handle large datasets (10k+ entities)')
  it('should validate entities before batch operation')
  it('should track performance metrics')
})

// core/tests/entity-loader.test.ts
describe('EntityLoader', () => {
  it('should load single entity by ID')
  it('should return null for missing entity')
  it('should eager load includes')
  it('should lazy load relationships on access')
  it('should batch load relationships (N+1 prevention)')
  it('should chunk IN() clauses for large FK sets')
  it('should respect max depth for recursive includes')
  it('should handle circular relationship loading')
  it('should configure IN clause chunk size')
  it('should set default loading strategy')
  it('should warn on loading errors')
})

// core/tests/lazy-loading-proxy.test.ts
describe('LazyLoadingProxy', () => {
  it('should create proxy for entity with relationships')
  it('should not proxy entity without relationships')
  it('should detect existing proxy (no double-wrap)')
  it('should load one-to-many on first access')
  it('should load many-to-one on first access')
  it('should cache loaded relationships')
  it('should handle concurrent access (dedupe promises)')
  it('should mark loading state correctly')
  it('should return default value for unloaded (null/[])')
  it('should warn on loading errors')
  it('should reset loading state on error')
  it('should detect if entity is lazy proxy')
})

// core/tests/ddl-builder.test.ts
describe('DdlBuilder', () => {
  it('should generate CREATE TABLE statement')
  it('should generate CREATE INDEX statements')
  it('should handle primary keys')
  it('should handle foreign keys')
  it('should respect column constraints')
  it('should support computed columns')
  it('should delegate to DDL strategy')
})

// core/tests/enhanced-sql-cache.test.ts
describe('EnhancedSqlCache', () => {
  it('should cache SQL with parameters')
  it('should return cache hit')
  it('should evict on TTL expiration')
  it('should use LRU eviction when full')
  it('should compress long cache keys')
  it('should track metrics (hits, misses, evictions)')
  it('should support cache invalidation by pattern')
  it('should warm cache from entries array')
  it('should clean up expired entries periodically')
  it('should dispose without memory leaks')
  it('should disable periodic cleanup in test environment')
  it('should update access count on hit')
  it('should generate metrics report')
})

// core/tests/entity-cache.test.ts
describe('EntityCache', () => {
  it('should cache entity by class + ID')
  it('should retrieve cached entity')
  it('should evict entity')
  it('should clear all entries')
  it('should respect TTL')
  it('should handle cache misses')
  it('should support composite keys')
})

// core/tests/retry-policy.test.ts
describe('ExponentialBackoffRetryPolicy', () => {
  it('should retry transient failures')
  it('should use exponential backoff')
  it('should respect max retries')
  it('should not retry permanent errors')
  it('should apply jitter to backoff')
  it('should calculate backoff delay correctly')
  it('should reset retry counter on success')
})

// core/tests/global-filter-applier.test.ts
describe('GlobalFilterApplier', () => {
  it('should apply soft-delete filter')
  it('should apply custom global filters')
  it('should combine multiple filters with AND')
  it('should skip filter if entity lacks column')
  it('should not modify original model (immutable)')
  it('should match filter entity by table name')
})

// core/tests/sql-helper.test.ts
describe('SqlHelper', () => {
  it('should build WHERE clause')
  it('should build INSERT clause')
  it('should build UPDATE clause')
  it('should format values for SQL')
  it('should escape identifiers')
  it('should handle NULL values')
  it('should parameterize values')
})

// core/tests/circuit-breaker.test.ts
describe('Circuit Breaker', () => {
  it('should remain closed under normal conditions')
  it('should open after threshold failures')
  it('should transition to half-open after timeout')
  it('should close after successful half-open attempt')
  it('should re-open on half-open failure')
  it('should apply exponential backoff on re-open')
})

// core/tests/health-check.test.ts
describe('Health Check', () => {
  it('should perform periodic health checks')
  it('should mark provider as healthy on success')
  it('should mark provider as degraded on repeated failures')
  it('should mark provider as unhealthy after threshold')
  it('should apply backoff on failures')
  it('should stop health checks on dispose')
})
```

#### Edge Cases

- Concurrent lazy loading requests
- Cache eviction under memory pressure
- Retry exhaustion scenarios
- Null/undefined handling in batch operations
- Circuit breaker state transitions
- Health check timeout scenarios
- Large IN() clause chunking

---

### 9. `packages/query` (3 days)

#### Classes to Test

- `Queryable<T>`
- `TypedQueryable<TEntity>`
- `QueryBuilder`
- `QueryModel`
- `PredicateParser<T>`
- `RowMaterializer<T>`
- `IncludePlanner<T>`
- `GlobalFilterApplier`
- `JoinPredicateParser`
- `InMemoryCountCache`

#### Unit Tests

```typescript
// query/tests/queryable.test.ts
describe('Queryable', () => {
  it('should create queryable for entity class')
  it('should add WHERE clause')
  it('should chain multiple WHERE clauses (AND)')
  it('should support SELECT projection')
  it('should support ORDER BY ascending')
  it('should support ORDER BY descending')
  it('should support LIMIT (take)')
  it('should support OFFSET (skip)')
  it('should support DISTINCT')
  it('should support GROUP BY with HAVING')
  it('should support INNER JOIN')
  it('should support LEFT JOIN')
  it('should support UNION')
  it('should support UNION ALL')
  it('should include relationships eagerly')
  it('should cache count() results')
  it('should deduplicate concurrent count() calls')
  it('should execute query and return entities')
  it('should execute first() and limit to 1')
  it('should execute firstOrDefault() and return null')
  it('should execute any() and return boolean')
  it('should support CTE (WITH clause) if provider supports')
  it('should apply global filters automatically')
  it('should fall back to client-side filtering for complex predicates')
  it('should throttle fallback usage')
  it('should abort query via AbortSignal')
  it('should materialize entities via RowMaterializer')
  it('should use L2 entity cache when enabled')
  it('should cache predicate SQL generation')
  it('should cache selector property extraction')
  it('should cache count results per WHERE signature')
  it('should invalidate count cache appropriately')
})

// query/tests/typed-queryable.test.ts
describe('TypedQueryable', () => {
  it('should enforce type-safe SELECT at compile time')
  it('should enforce type-safe WHERE predicates')
  it('should enforce type-safe ORDER BY')
  it('should enforce type-safe INCLUDE relationships')
  it('should wrap Queryable with typed interface')
  it('should preserve chainability')
  it('should unwrap to Queryable for execution')
  it('should support all Queryable methods')
})

// query/tests/query-builder.test.ts
describe('QueryBuilder', () => {
  it('should generate SELECT SQL from QueryModel')
  it('should use dialect for SQL generation')
  it('should cache generated SQL by key')
  it('should return cached SQL on hit')
  it('should invalidate cache by pattern')
  it('should include parameters in output')
  it('should normalize SQL expressions')
  it('should build cache key from options + provider + namespace')
  it('should use default enhanced cache')
  it('should support custom cache instance')
})

// query/tests/query-model.test.ts
describe('QueryModel', () => {
  it('should store SELECT projections')
  it('should store WHERE clauses')
  it('should store ORDER BY clauses')
  it('should store GROUP BY with HAVING')
  it('should store JOIN clauses')
  it('should store LIMIT and OFFSET')
  it('should store DISTINCT flag')
  it('should store UNION operations')
  it('should clone immutably')
  it('should deep clone all properties')
})

// query/tests/predicate-parser.test.ts
describe('PredicateParser', () => {
  it('should parse simple binary expression (a.x === 5)')
  it('should parse comparison operators (===, >, <, >=, <=)')
  it('should parse AND chains (a.x > 5 && a.y < 10)')
  it('should return null for unsupported constructs')
  it('should return null for overly long predicates')
  it('should bail out for function calls')
  it('should bail out for OR/nullish coalescing')
  it('should parse literal values (number, string, boolean, null)')
  it('should reject variable references on right side')
  it('should validate identifier format')
  it('should handle whitespace variations')
})

// query/tests/row-materializer.test.ts
describe('RowMaterializer', () => {
  it('should map raw row to entity instance')
  it('should use L2 cache if enabled')
  it('should cache entity after materialization')
  it('should convert column types (boolean, number, Date)')
  it('should notify middleware on materialization')
  it('should handle missing metadata gracefully')
  it('should handle missing columns in row')
  it('should prefer column name over property name')
  it('should handle null values correctly')
})

// query/tests/include-planner.test.ts
describe('IncludePlanner', () => {
  it('should populate includes for entity array')
  it('should skip if no entity loader')
  it('should skip if limit === 1')
  it('should call entity loader with includes')
  it('should respect depth option')
  it('should handle empty includes array')
})

// query/tests/join-predicate-parser.test.ts
describe('JoinPredicateParser', () => {
  it('should parse join ON condition')
  it('should extract left/right table references')
  it('should generate SQL ON clause')
  it('should handle complex join predicates')
  it('should validate join syntax')
})

// query/tests/count-cache.test.ts
describe('InMemoryCountCache', () => {
  it('should cache count results')
  it('should return cached count')
  it('should respect TTL expiration')
  it('should evict oldest entries when full')
  it('should clear all entries')
})
```

#### Edge Cases

- Empty result sets
- Null/undefined in WHERE clauses
- Invalid lambda expressions
- Cache key collisions
- Type conversion edge cases (null, undefined, empty string)
- Concurrent count() requests
- Predicate fallback throttling
- Aborted queries mid-execution

---

### 10. `packages/orm` (2 days)

#### Classes to Test

- `DbContext`
- `DbSet<T>`
- `ChangeTracker`
- `InsertCommand`, `UpdateCommand`, `DeleteCommand`
- `ChangeValidationService`

#### Unit Tests

```typescript
// orm/tests/db-context.test.ts
describe('DbContext', () => {
  it('should initialize with provider')
  it('should auto-generate DbSet properties')
  it('should connect to database on first operation')
  it('should disconnect and cleanup')
  it('should track entities via ChangeTracker')
  it('should save all changes in transaction')
  it('should rollback on save error')
  it('should validate entities before save')
  it('should apply audit metadata (createdAt, updatedAt)')
  it('should apply soft-delete instead of hard delete')
  it('should invalidate cache on save')
  it('should support global filters')
  it('should configure performance options')
  it('should enable diagnostics/memory profiling')
  it('should respect optimistic concurrency (version field)')
  it('should throw ConcurrencyError on version mismatch')
  it('should execute migrations on ensureCreated()')
  it('should get DbSet by entity class')
  it('should reuse DbSet instances')
  it('should pass entity cache to DbSet')
  it('should pass global filters to DbSet')
})

// orm/tests/db-set.test.ts
describe('DbSet', () => {
  it('should add entity to ChangeTracker')
  it('should update entity in ChangeTracker')
  it('should remove entity from ChangeTracker')
  it('should add multiple entities (addRange)')
  it('should update multiple entities (updateRange)')
  it('should remove multiple entities (removeRange)')
  it('should find entity by primary key')
  it('should return null for missing entity')
  it('should create Queryable for LINQ queries')
  it('should apply eager loading options')
  it('should apply global filters to queries')
  it('should use L2 entity cache')
  it('should chunk large IN() queries')
  it('should return typed DbSet')
})

// orm/tests/change-tracker.test.ts
describe('ChangeTracker', () => {
  it('should track entity as Added')
  it('should track entity as Modified')
  it('should track entity as Deleted')
  it('should track entity as Unchanged (attach)')
  it('should clone originalValues for Modified entities')
  it('should return all changes (exclude Unchanged)')
  it('should get entity state')
  it('should detect modified properties')
  it('should clear all tracked entities')
  it('should handle entity already tracked (state transition)')
  it('should shallow clone entity for originalValues')
})

// orm/tests/insert-command.test.ts
describe('InsertCommand', () => {
  it('should generate INSERT SQL')
  it('should handle auto-increment PKs')
  it('should apply audit metadata')
  it('should validate entity before insert')
  it('should execute insert via provider')
  it('should return inserted entity with generated ID')
})

// orm/tests/update-command.test.ts
describe('UpdateCommand', () => {
  it('should generate UPDATE SQL for modified properties')
  it('should include WHERE clause for PK')
  it('should handle optimistic concurrency (version)')
  it('should throw ConcurrencyError on version mismatch')
  it('should apply audit metadata (updatedAt)')
  it('should validate entity before update')
})

// orm/tests/delete-command.test.ts
describe('DeleteCommand', () => {
  it('should generate DELETE SQL')
  it('should include WHERE clause for PK')
  it('should handle soft-delete option')
  it('should apply audit metadata (deletedAt)')
  it('should execute hard delete when configured')
})

// orm/tests/change-validation-service.test.ts
describe('ChangeValidationService', () => {
  it('should validate all tracked changes')
  it('should execute onCreate validations for Added entities')
  it('should execute onUpdate validations for Modified entities')
  it('should execute always validations for all changes')
  it('should collect all validation errors')
  it('should throw ValidationError with all errors')
  it('should skip validation if no rules defined')
  it('should translate error messages if translator provided')
})
```

#### Edge Cases

- Empty ChangeTracker (saveChanges no-op)
- Concurrent entity modifications
- Missing primary key on insert
- Version field not set (concurrency check skipped)
- Circular entity references in add()
- Validation errors on multiple entities
- Soft-delete with missing deletedAt column

---

### 11. `packages/migrations` (2 days)

#### Classes to Test

- `Migration` (abstract)
- `MigrationRunner`
- `DiffBasedMigration`
- `MigrationBuilder`
- `SchemaDiff`, `TableDiff`, `ColumnDiff`, `IndexDiff`, `ForeignKeyDiff`
- `generateMigrationFromDiff`

#### Unit Tests

```typescript
// migrations/tests/migration-runner.test.ts
describe('MigrationRunner', () => {
  it('should create migrations table on first run')
  it('should get applied migrations from database')
  it('should apply pending migrations in order')
  it('should skip already applied migrations')
  it('should record migration in __migrations table')
  it('should rollback migration')
  it('should rollback to target version')
  it('should handle migration error (transaction rollback)')
  it('should throw on duplicate version')
  it('should sort migrations by version')
  it('should handle empty migrations list')
})

// migrations/tests/diff-based-migration.test.ts
describe('DiffBasedMigration', () => {
  it('should generate up/down SQL from SchemaDiff')
  it('should execute up() statements in order')
  it('should execute down() statements in order')
  it('should call lifecycle hooks (before/after)')
  it('should skip statement if beforeStatement hook returns false')
  it('should use correct dialect for SQL generation')
  it('should handle async diff() method')
  it('should handle sync diff() method')
})

// migrations/tests/migration-builder.test.ts
describe('MigrationBuilder', () => {
  it('should create table via builder')
  it('should drop table')
  it('should add column to existing table')
  it('should alter column type/constraints')
  it('should drop column')
  it('should create index')
  it('should drop index')
  it('should create foreign key')
  it('should drop foreign key')
  it('should rename table')
  it('should rename column')
  it('should convert to SchemaDiff')
  it('should generate SQL via toSql(dialect)')
  it('should support composite operations')
  it('should chain operations fluently')
})

// migrations/tests/schema-diff.test.ts
describe('SchemaDiff', () => {
  it('should detect table additions')
  it('should detect table deletions')
  it('should detect table renames')
  it('should generate up/down SQL for table changes')
})

// migrations/tests/table-diff.test.ts
describe('TableDiff', () => {
  it('should detect column additions')
  it('should detect column modifications')
  it('should detect column deletions')
  it('should detect column renames')
  it('should detect index additions')
  it('should detect index deletions')
  it('should detect foreign key additions')
  it('should detect foreign key deletions')
})

// migrations/tests/migration-generator.test.ts
describe('generateMigrationFromDiff', () => {
  it('should generate CREATE TABLE statements')
  it('should generate DROP TABLE statements')
  it('should generate ALTER TABLE statements')
  it('should generate reversible migrations')
  it('should use correct SQL dialect')
  it('should handle composite changes')
})
```

#### Edge Cases

- Empty migration (no-op)
- Migration order conflicts
- Rollback of non-reversible migrations
- Schema diff for complex changes
- Missing dialect implementation
- Concurrent migration attempts

---

## TIER 2: Adapters and Utilities (11 days)

### 12-15. Dialect Packages (2 days each = 8 days)

#### Packages

- `dialect-sqlite` (2 days)
- `dialect-postgres` (2 days)
- `dialect-mysql` (2 days)
- `dialect-mssql` (2 days)

#### What to Test for Each Dialect

```typescript
// dialect-X/tests/X-dialect.test.ts
describe('SQL Dialect', () => {
  it('should build SELECT with WHERE')
  it('should build SELECT with JOIN')
  it('should build SELECT with ORDER BY, LIMIT, OFFSET')
  it('should build SELECT with GROUP BY, HAVING')
  it('should build INSERT statement')
  it('should build UPDATE statement')
  it('should build DELETE statement')
  it('should handle DISTINCT')
  it('should handle UNION / UNION ALL')
  it('should escape identifiers (table/column names)')
  it('should parameterize values')
  it('should generate correct placeholder syntax (?, $1, @p1)')
  it('should support CTE (WITH clause) if dialect allows')
  it('should handle dialect-specific types (JSONB, UUID, etc.)')
  it('should support pagination (LIMIT/OFFSET vs TOP/OFFSET FETCH)')
  it('should prevent SQL injection via escaping')
  it('should handle reserved keywords in identifiers')
  it('should generate subqueries')
  it('should handle case-sensitive identifiers')
})

// dialect-X/tests/X-ddl-strategy.test.ts
describe('DDL Strategy', () => {
  it('should generate CREATE TABLE SQL')
  it('should generate column definitions with types')
  it('should generate primary key constraint')
  it('should generate foreign key constraints')
  it('should generate unique constraints')
  it('should generate default values')
  it('should generate CREATE INDEX SQL')
  it('should support unique indexes')
  it('should support composite indexes')
  it('should support partial indexes (if supported)')
  it('should generate DROP TABLE SQL')
  it('should generate ALTER TABLE ADD COLUMN')
  it('should generate ALTER TABLE DROP COLUMN')
  it('should generate ALTER TABLE MODIFY COLUMN')
  it('should handle auto-increment/identity columns')
  it('should respect IF EXISTS / IF NOT EXISTS')
  it('should generate CHECK constraints')
})
```

#### Edge Cases (Per Dialect)

**SQLite:**
- No ALTER COLUMN support (requires table rebuild)
- Limited foreign key support
- AUTOINCREMENT vs INTEGER PRIMARY KEY
- PRAGMA foreign_keys requirement

**PostgreSQL:**
- SERIAL vs IDENTITY columns
- RETURNING clause support
- Array types and JSONB
- Partial index predicates
- Schema-qualified table names

**MySQL:**
- AUTO_INCREMENT vs GENERATED
- Backtick identifier escaping
- UNSIGNED types
- Engine specification (InnoDB)

**MSSQL:**
- IDENTITY columns
- TOP vs OFFSET FETCH
- Square bracket identifier escaping
- NVARCHAR vs VARCHAR

---

### 16-19. Provider Packages (0.5 day each = 2 days)

#### Packages

- `provider-sqlite` (0.5 day)
- `provider-postgres` (0.5 day)
- `provider-mysql` (0.5 day)
- `provider-mssql` (0.5 day)

#### What to Test for Each Provider

```typescript
// provider-X/tests/X-provider.test.ts
describe('DatabaseProvider Implementation', () => {
  it('should connect to database')
  it('should disconnect and cleanup pool')
  it('should create table from EntityMetadata')
  it('should insert entity and return with generated ID')
  it('should update entity')
  it('should delete entity')
  it('should find entity by ID')
  it('should find all entities')
  it('should execute custom query')
  it('should execute non-query (DDL/DML)')
  it('should begin transaction')
  it('should commit transaction')
  it('should rollback transaction')
  it('should support nested transactions (savepoints)')
  it('should handle connection pool settings')
  it('should retry transient failures')
  it('should map database errors to standardized types')
  it('should convert values to/from database types')
  it('should support health checks')
  it('should support circuit breaker')
  it('should log SQL via middleware')
  it('should apply soft-delete filter')
  it('should handle connection string parsing')
  it('should respect pool options (min, max, timeout)')
})

// provider-X/tests/error-mapping.test.ts
describe('Error Mapping', () => {
  it('should map unique constraint violation')
  it('should map foreign key violation')
  it('should map not null violation')
  it('should map connection timeout')
  it('should map deadlock detection')
  it('should map generic database error')
  it('should preserve original error details')
})

// provider-X/tests/type-conversion.test.ts
describe('Type Conversion', () => {
  it('should convert boolean to/from database')
  it('should convert Date to/from database')
  it('should convert JSON to/from database')
  it('should handle NULL values')
  it('should handle undefined values')
  it('should convert numbers correctly')
  it('should handle Buffer/binary data')
})
```

#### Edge Cases (Per Provider)

**SQLiteProvider:**
- File-based database creation
- PRAGMA statements
- Type affinity behavior
- Callback-based API wrapping

**PostgresProvider:**
- Pool configuration
- Parameter numbering ($1, $2, ...)
- RETURNING clause support
- Type OID mapping

**MySqlProvider:**
- Connection URI parsing
- Positional placeholders
- Pool.query() vs Connection.query()
- Timezone handling

**MssqlProvider:**
- Connection pool lifecycle
- Request creation
- Named parameters (@p1, @p2, ...)
- SCOPE_IDENTITY() for inserts

---

### 20. `packages/cache`, `cache-redis`, `cache-memcached` (0.5 day)

```typescript
// cache/tests/entity-cache.test.ts
describe('EntityCache Interface', () => {
  it('should define get method signature')
  it('should define set method signature')
  it('should define evict method signature')
  it('should define clear method signature')
})

// cache-redis/tests/redis-cache.test.ts
describe('RedisCache', () => {
  it('should connect to Redis')
  it('should cache entities in Redis')
  it('should serialize/deserialize entities')
  it('should support TTL expiration')
  it('should handle Redis connection errors')
  it('should fall back gracefully on failure')
  it('should use key prefix for namespacing')
  it('should support composite keys')
  it('should handle JSON serialization errors')
})

// cache-memcached/tests/memcached-cache.test.ts
describe('MemcachedCache', () => {
  it('should connect to Memcached')
  it('should cache entities')
  it('should handle serialization')
  it('should support TTL')
  it('should handle connection errors')
  it('should retry on transient failures')
})
```

---

### 21. `packages/concurrency` (0.5 day)

```typescript
// concurrency/tests/optimistic-concurrency.test.ts
describe('Optimistic Concurrency', () => {
  it('should detect concurrent modification via version field')
  it('should throw ConcurrencyError on version mismatch')
  it('should increment version on successful update')
  it('should handle missing version field gracefully')
  it('should include conflict details in error')
  it('should support custom version field name')
})

// concurrency/tests/pessimistic-locking.test.ts
describe('Pessimistic Locking', () => {
  it('should acquire row lock (SELECT FOR UPDATE)')
  it('should release lock on transaction commit')
  it('should timeout on lock contention')
  it('should handle deadlock detection')
})
```

---

### 22. `packages/pagination` (0.25 day)

```typescript
// pagination/tests/pagination-helpers.test.ts
describe('Pagination Helpers', () => {
  it('should calculate offset from page number')
  it('should calculate total pages from count')
  it('should generate page metadata')
  it('should handle edge cases (page 0, negative)')
  it('should support cursor-based pagination')
  it('should encode/decode cursor tokens')
})

// pagination/tests/paginated-result.test.ts
describe('PaginatedResult', () => {
  it('should wrap data with pagination metadata')
  it('should include hasNextPage flag')
  it('should include hasPreviousPage flag')
  it('should include total count')
  it('should include page size')
})
```

---

### 23. `packages/telemetry`, `prometheus-sql-logger`, `open-telemetry-sql-logger`, `composite-sql-logger` (0.75 day)

```typescript
// telemetry/tests/telemetry-integration.test.ts
describe('Telemetry Integration', () => {
  it('should collect query metrics')
  it('should collect cache metrics')
  it('should collect error metrics')
  it('should export metrics to collector')
  it('should handle collector unavailability')
})

// prometheus-sql-logger/tests/prometheus-logger.test.ts
describe('PrometheusLogger', () => {
  it('should expose Prometheus metrics endpoint')
  it('should track query duration histogram')
  it('should track query counter by type (SELECT, INSERT, UPDATE, DELETE)')
  it('should track cache hit ratio')
  it('should track error counter by type')
  it('should register metrics with registry')
  it('should support custom metric labels')
  it('should format metrics in Prometheus text format')
})

// open-telemetry-sql-logger/tests/otel-logger.test.ts
describe('OpenTelemetryLogger', () => {
  it('should create spans for queries')
  it('should attach attributes to spans (sql, params, duration)')
  it('should propagate context')
  it('should export traces to collector')
  it('should handle exporter errors gracefully')
  it('should record exceptions in spans')
  it('should support custom span attributes')
})

// composite-sql-logger/tests/composite-logger.test.ts
describe('CompositeSqlLogger', () => {
  it('should delegate to all child loggers')
  it('should handle child logger errors independently')
  it('should support dynamic logger addition/removal')
  it('should aggregate metrics from all loggers')
})
```

---

## TIER 3: Plugins and Integrations (7 days)

### 24. `packages/cli` (2 days)

```typescript
// cli/tests/migration-commands.test.ts
describe('Migration Commands', () => {
  it('should generate migration file with timestamp')
  it('should run pending migrations')
  it('should rollback last migration')
  it('should rollback to specific version')
  it('should show migration status')
  it('should handle command-line arguments')
  it('should display help text')
  it('should support config file')
  it('should validate migration name format')
  it('should create migrations directory if missing')
})

// cli/tests/codegen.test.ts
describe('Code Generation', () => {
  it('should scaffold entity classes from database')
  it('should generate migration from schema diff')
  it('should generate TypeScript interfaces')
  it('should respect naming conventions')
  it('should handle relationships correctly')
  it('should generate indexes and constraints')
})

// cli/tests/db-commands.test.ts
describe('Database Commands', () => {
  it('should create database from entities (ensureCreated)')
  it('should drop database')
  it('should sync schema (drop + create)')
  it('should seed database with fixtures')
  it('should export database to SQL file')
})
```

---

### 25. Plugins (2 days)

```typescript
// plugin-audit/tests/audit-plugin.test.ts
describe('Audit Plugin', () => {
  it('should set createdAt on insert')
  it('should set updatedAt on update')
  it('should set createdBy/updatedBy if user context provided')
  it('should respect audit options (enabled/disabled)')
  it('should handle missing audit columns gracefully')
  it('should support custom column names')
  it('should apply to all entities or specific ones')
})

// plugin-multi-tenant/tests/multi-tenant-plugin.test.ts
describe('Multi-Tenant Plugin', () => {
  it('should filter queries by tenant ID')
  it('should inject tenant ID on insert')
  it('should prevent cross-tenant access')
  it('should support tenant context from request')
  it('should handle missing tenant context error')
  it('should support tenant ID resolution strategy')
  it('should bypass tenant filter for admin context')
})

// plugin-soft-delete/tests/soft-delete-plugin.test.ts
describe('Soft Delete Plugin', () => {
  it('should mark entity as deleted (soft delete)')
  it('should filter deleted entities from queries')
  it('should support hard delete option')
  it('should support restore functionality')
  it('should set deletedAt timestamp')
  it('should set deletedBy if audit enabled')
  it('should support custom soft-delete column')
  it('should include deleted entities with includeDeleted option')
})
```

---

### 26. `packages/integration-nestjs` (1 day)

```typescript
// integration-nestjs/tests/nestjs-module.test.ts
describe('NestJS Integration Module', () => {
  it('should register DbContext as provider')
  it('should inject DbContext into services')
  it('should support forRoot() static method')
  it('should support forRootAsync() with config factory')
  it('should register entity repositories')
  it('should apply NestJS lifecycle hooks')
  it('should handle module cleanup on app shutdown')
})

// integration-nestjs/tests/repository-decorator.test.ts
describe('@InjectRepository Decorator', () => {
  it('should inject repository for entity class')
  it('should provide typed repository')
  it('should handle custom repository classes')
})
```

---

### 27. `packages/examples` (1 day)

```typescript
// examples/tests/example-validation.test.ts
describe('Example Projects', () => {
  it('should compile basic-crud example')
  it('should compile relationships example')
  it('should compile migrations example')
  it('should compile transactions example')
  it('should compile caching example')
  it('should compile multi-tenant example')
  it('should run all examples without errors')
  it('should validate example code follows best practices')
})
```

---

### 28. Remaining Utilities (1 day)

```typescript
// composite-sql-logger/tests/composite-logger.test.ts
// (Already covered in Tier 2 telemetry section)
```

---

## E2E Tests (9 days)

### `packages/e2e-tests` - End-to-End Testing

#### Infrastructure Setup (1 day)

Create `docker-compose.yml` for test databases:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_pass
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: test_db
      MYSQL_USER: test_user
      MYSQL_PASSWORD: test_pass
      MYSQL_ROOT_PASSWORD: root_pass
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: Y
      SA_PASSWORD: YourStrong@Passw0rd123
      MSSQL_PID: Developer
    ports:
      - "1433:1433"
    healthcheck:
      test: ["CMD-SHELL", "/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P 'YourStrong@Passw0rd123' -Q 'SELECT 1'"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  memcached:
    image: memcached:1.6-alpine
    ports:
      - "11211:11211"
```

#### E2E Test Scenarios (8 days)

##### Day 1-2: CRUD Workflows & Change Tracking

```typescript
// e2e-tests/tests/crud-workflows.test.ts
describe('CRUD Workflows - All Providers', () => {
  describe.each(['sqlite', 'postgres', 'mysql', 'mssql'])('%s provider', (provider) => {
    it('should create entity with auto-increment ID', async () => {
      // Arrange: Create DbContext with provider
      // Act: Insert entity via DbSet.add() + saveChanges()
      // Assert: Entity has generated ID
    })

    it('should read entity by ID', async () => {
      // Arrange: Insert test entity
      // Act: Find by ID
      // Assert: Returns correct entity
    })

    it('should read all entities', async () => {
      // Arrange: Insert 3 test entities
      // Act: Query via DbSet (no filters)
      // Assert: Returns all 3 entities
    })

    it('should update entity properties', async () => {
      // Arrange: Insert test entity
      // Act: Modify property, call update(), saveChanges()
      // Assert: Database reflects changes
    })

    it('should delete entity', async () => {
      // Arrange: Insert test entity
      // Act: Call remove(), saveChanges()
      // Assert: Entity no longer in database
    })

    it('should handle batch insert (1000 entities)', async () => {
      // Arrange: Generate 1000 test entities
      // Act: Use BatchOperations.bulkInsert()
      // Assert: All inserted, duration < 5s
    })

    it('should handle batch update (1000 entities)', async () => {
      // Arrange: Insert 1000 entities
      // Act: Modify all, use BatchOperations.bulkUpdate()
      // Assert: All updated, duration < 5s
    })

    it('should handle batch delete (1000 entities)', async () => {
      // Arrange: Insert 1000 entities
      // Act: Use BatchOperations.bulkDelete()
      // Assert: All deleted, duration < 3s
    })
  })
})

// e2e-tests/tests/change-tracking.test.ts
describe('Change Tracking', () => {
  it('should track Added entities', async () => {
    // Arrange: Create context
    // Act: Add entity to DbSet
    // Assert: ChangeTracker shows Added state
  })

  it('should track Modified entities', async () => {
    // Arrange: Insert and load entity
    // Act: Modify property
    // Assert: ChangeTracker shows Modified state with modified properties
  })

  it('should track Deleted entities', async () => {
    // Arrange: Insert and load entity
    // Act: Call remove()
    // Assert: ChangeTracker shows Deleted state
  })

  it('should save all changes in single transaction', async () => {
    // Arrange: Add, modify, delete different entities
    // Act: Call saveChanges()
    // Assert: All operations committed together
  })

  it('should rollback all changes on error', async () => {
    // Arrange: Add valid entity + invalid entity (constraint violation)
    // Act: Call saveChanges() (should fail)
    // Assert: Valid entity also rolled back
  })

  it('should detect concurrent modification (optimistic concurrency)', async () => {
    // Arrange: Insert entity with version field
    // Act: Load in 2 contexts, modify both, save first, save second
    // Assert: Second save throws ConcurrencyError
  })
})
```

##### Day 3: LINQ Queries

```typescript
// e2e-tests/tests/linq-queries.test.ts
describe('LINQ Queries', () => {
  describe('Basic Queries', () => {
    it('should execute WHERE with single condition', async () => {
      // Arrange: Insert entities with various ages
      // Act: Query users.where(u => u.age > 18)
      // Assert: Returns only adults
    })

    it('should execute WHERE with multiple AND conditions', async () => {
      // Arrange: Insert entities
      // Act: Query users.where(u => u.age > 18 && u.active === true)
      // Assert: Returns only active adults
    })

    it('should execute ORDER BY ascending', async () => {
      // Arrange: Insert entities in random order
      // Act: Query users.orderBy(u => u.name)
      // Assert: Results sorted by name ASC
    })

    it('should execute ORDER BY descending', async () => {
      // Arrange: Insert entities
      // Act: Query users.orderByDescending(u => u.createdAt)
      // Assert: Results sorted by createdAt DESC
    })

    it('should execute LIMIT (take)', async () => {
      // Arrange: Insert 100 entities
      // Act: Query users.take(10)
      // Assert: Returns exactly 10 entities
    })

    it('should execute OFFSET (skip) + LIMIT', async () => {
      // Arrange: Insert 100 entities
      // Act: Query users.skip(20).take(10)
      // Assert: Returns entities 21-30
    })

    it('should execute DISTINCT', async () => {
      // Arrange: Insert entities with duplicate names
      // Act: Query users.select(u => u.name).distinct()
      // Assert: Returns unique names only
    })
  })

  describe('Aggregate Queries', () => {
    it('should execute count()', async () => {
      // Arrange: Insert 50 entities
      // Act: Query users.count()
      // Assert: Returns 50
    })

    it('should execute count() with filter', async () => {
      // Arrange: Insert 30 active + 20 inactive
      // Act: Query users.where(u => u.active === true).count()
      // Assert: Returns 30
    })

    it('should execute first()', async () => {
      // Arrange: Insert ordered entities
      // Act: Query users.orderBy(u => u.id).first()
      // Assert: Returns first entity
    })

    it('should throw on first() with empty result', async () => {
      // Arrange: Empty table
      // Act: Query users.first()
      // Assert: Throws error
    })

    it('should execute firstOrDefault()', async () => {
      // Arrange: Empty table
      // Act: Query users.firstOrDefault()
      // Assert: Returns null
    })

    it('should execute any()', async () => {
      // Arrange: Insert entities
      // Act: Query users.where(u => u.age > 100).any()
      // Assert: Returns false
    })
  })

  describe('Advanced Queries', () => {
    it('should execute GROUP BY with count', async () => {
      // Arrange: Insert entities with various statuses
      // Act: Query users.groupBy(u => u.status).select({ status, count })
      // Assert: Returns status groups with counts
    })

    it('should execute GROUP BY with HAVING', async () => {
      // Arrange: Insert entities
      // Act: Query users.groupBy(u => u.status).having(g => g.count > 10)
      // Assert: Returns only groups with > 10 members
    })

    it('should execute INNER JOIN', async () => {
      // Arrange: Insert users and orders
      // Act: Query users.join(orders, u => u.id, o => o.userId)
      // Assert: Returns users with their orders
    })

    it('should execute LEFT JOIN', async () => {
      // Arrange: Insert users (some with orders, some without)
      // Act: Query users.leftJoin(orders, u => u.id, o => o.userId)
      // Assert: Returns all users, orders null for some
    })

    it('should execute UNION', async () => {
      // Arrange: Insert active and inactive users
      // Act: Query activeUsers.union(inactiveUsers)
      // Assert: Returns combined result set (distinct)
    })

    it('should execute UNION ALL', async () => {
      // Arrange: Insert entities in 2 sets
      // Act: Query set1.unionAll(set2)
      // Assert: Returns combined result set (with duplicates)
    })

    it('should execute subquery', async () => {
      // Arrange: Insert users and orders
      // Act: Query users.where(u => u.id.in(orders.select(o => o.userId)))
      // Assert: Returns users who have orders
    })

    it('should use query cache for repeated queries', async () => {
      // Arrange: Execute query once
      // Act: Execute same query again
      // Assert: Second query uses cached SQL
    })
  })
})
```

##### Day 4: Relationships & Lazy Loading

```typescript
// e2e-tests/tests/relationships.test.ts
describe('Relationships', () => {
  describe('Eager Loading', () => {
    it('should eager load one-to-many relationships', async () => {
      // Arrange: Insert user with 3 orders
      // Act: Load user with include('orders')
      // Assert: user.orders array populated
    })

    it('should eager load many-to-one relationships', async () => {
      // Arrange: Insert order with user
      // Act: Load order with include('user')
      // Assert: order.user populated
    })

    it('should eager load one-to-one relationships', async () => {
      // Arrange: Insert user with profile
      // Act: Load user with include('profile')
      // Assert: user.profile populated
    })

    it('should eager load many-to-many with junction table', async () => {
      // Arrange: Insert students and courses with enrollments
      // Act: Load student with include('courses')
      // Assert: student.courses array populated
    })

    it('should eager load nested relationships (2 levels)', async () => {
      // Arrange: User -> Orders -> OrderItems
      // Act: Load user with include('orders.orderItems')
      // Assert: All relationships populated
    })
  })

  describe('Lazy Loading', () => {
    it('should lazy load on property access', async () => {
      // Arrange: Insert user with orders, load user (no includes)
      // Act: Access user.orders property
      // Assert: Orders loaded on demand
    })

    it('should cache lazy loaded relationships', async () => {
      // Arrange: Insert user with orders
      // Act: Access user.orders twice
      // Assert: Second access returns cached value (no DB query)
    })

    it('should handle concurrent lazy load requests', async () => {
      // Arrange: Insert user with orders
      // Act: Access user.orders in parallel from 2 contexts
      // Assert: Only 1 DB query executed (deduplication)
    })

    it('should return default for unloaded collections ([])', async () => {
      // Arrange: Load user without includes
      // Act: Access user.orders immediately (before lazy load)
      // Assert: Returns empty array
    })

    it('should return default for unloaded references (null)', async () => {
      // Arrange: Load order without includes
      // Act: Access order.user immediately
      // Assert: Returns null
    })
  })

  describe('N+1 Prevention', () => {
    it('should batch load relationships for collection', async () => {
      // Arrange: Insert 100 users with orders
      // Act: Load all users, access all user.orders
      // Assert: Only 2 queries total (users + batched orders)
    })

    it('should chunk large IN() clauses', async () => {
      // Arrange: Insert 2000 users with orders
      // Act: Load all users, access all user.orders
      // Assert: IN() clauses chunked (max 1000 per query)
    })
  })

  describe('Cascade Operations', () => {
    it('should cascade delete one-to-many relationships', async () => {
      // Arrange: Insert user with 3 orders
      // Act: Delete user with cascade option
      // Assert: Orders also deleted
    })

    it('should handle circular relationships', async () => {
      // Arrange: User -> Posts -> Comments -> User (circular)
      // Act: Load user with includes
      // Assert: Loads without infinite loop
    })
  })
})
```

##### Day 5: Migrations

```typescript
// e2e-tests/tests/migrations.test.ts
describe('Migrations', () => {
  describe('Migration Execution', () => {
    it('should run initial migration (create tables)', async () => {
      // Arrange: Empty database
      // Act: Run migration to create Users table
      // Assert: Table exists with correct schema
    })

    it('should apply pending migrations in order', async () => {
      // Arrange: 3 pending migrations
      // Act: Run MigrationRunner.migrate()
      // Assert: All 3 applied in version order
    })

    it('should skip already applied migrations', async () => {
      // Arrange: Migration already applied
      // Act: Run migrate() again
      // Assert: Migration skipped
    })

    it('should record migration in __migrations table', async () => {
      // Arrange: New migration
      // Act: Apply migration
      // Assert: Entry in __migrations with timestamp
    })

    it('should rollback last migration', async () => {
      // Arrange: Applied migration that adds column
      // Act: Rollback migration
      // Assert: Column removed from table
    })

    it('should rollback to target version', async () => {
      // Arrange: 5 migrations applied
      // Act: Rollback to version 3
      // Assert: Migrations 4 and 5 rolled back
    })

    it('should handle migration error with transaction rollback', async () => {
      // Arrange: Migration with syntax error
      // Act: Run migrate()
      // Assert: Migration fails, no partial changes
    })
  })

  describe('Schema Changes', () => {
    it('should add column to existing table', async () => {
      // Arrange: Table with 3 columns
      // Act: Migration adds 4th column
      // Assert: New column exists with correct type
    })

    it('should alter column type', async () => {
      // Arrange: Column as VARCHAR(50)
      // Act: Migration changes to VARCHAR(255)
      // Assert: Column type updated
    })

    it('should drop column', async () => {
      // Arrange: Table with column to remove
      // Act: Migration drops column
      // Assert: Column no longer exists
    })

    it('should create index', async () => {
      // Arrange: Table without index
      // Act: Migration creates index on column
      // Assert: Index exists
    })

    it('should create foreign key constraint', async () => {
      // Arrange: Two tables without FK
      // Act: Migration adds FK constraint
      // Assert: FK enforced (delete parent fails)
    })

    it('should rename table', async () => {
      // Arrange: Table named "Users"
      // Act: Migration renames to "Customers"
      // Assert: Old name gone, new name exists
    })

    it('should rename column', async () => {
      // Arrange: Column named "email"
      // Act: Migration renames to "email_address"
      // Assert: Old name gone, new name exists
    })
  })

  describe('Diff-Based Migrations', () => {
    it('should detect schema drift', async () => {
      // Arrange: Database schema differs from entity definitions
      // Act: Generate diff
      // Assert: Diff identifies missing columns
    })

    it('should generate migration from schema diff', async () => {
      // Arrange: New entity class with columns
      // Act: Generate migration from diff
      // Assert: Migration file created with SQL
    })

    it('should generate reversible migration', async () => {
      // Arrange: Schema diff (add column)
      // Act: Generate migration
      // Assert: up() adds column, down() drops column
    })
  })
})
```

##### Day 6: Caching

```typescript
// e2e-tests/tests/caching.test.ts
describe('Caching', () => {
  describe('SQL Query Cache', () => {
    it('should cache generated SQL', async () => {
      // Arrange: Execute query
      // Act: Execute same query again
      // Assert: Second query uses cached SQL (no generation)
    })

    it('should cache count() results', async () => {
      // Arrange: Execute count() query
      // Act: Execute same count() again (no data changes)
      // Assert: Returns cached count (no DB query)
    })

    it('should invalidate cache on data change', async () => {
      // Arrange: Execute query, cache result
      // Act: Insert new entity, execute query again
      // Assert: Cache invalidated, fresh query executed
    })

    it('should respect TTL expiration', async () => {
      // Arrange: Execute query, cache with 1s TTL
      // Act: Wait 1.5s, execute query again
      // Assert: Cache expired, fresh query executed
    })

    it('should evict LRU entries when cache full', async () => {
      // Arrange: Fill cache to max size
      // Act: Execute new query
      // Assert: Oldest entry evicted
    })

    it('should warm cache from entries', async () => {
      // Arrange: Pre-generate common query SQL
      // Act: Warm cache with entries
      // Assert: Queries hit cache immediately
    })
  })

  describe('Entity Cache (L2)', () => {
    it('should cache entities by ID', async () => {
      // Arrange: Load entity by ID
      // Act: Load same entity again
      // Assert: Second load from cache (no DB query)
    })

    it('should evict entity from cache', async () => {
      // Arrange: Cached entity
      // Act: Evict entity
      // Assert: Next load hits database
    })

    it('should invalidate entity cache on save', async () => {
      // Arrange: Cached entity
      // Act: Update entity via saveChanges()
      // Assert: Cache invalidated for that entity
    })

    it('should use entity cache across DbSet queries', async () => {
      // Arrange: Load entity via find()
      // Act: Query via where() that returns same entity
      // Assert: Entity retrieved from cache
    })
  })

  describe('Redis Cache Integration', () => {
    it('should cache entities in Redis', async () => {
      // Arrange: Configure Redis cache
      // Act: Load entity
      // Assert: Entity stored in Redis
    })

    it('should retrieve entity from Redis', async () => {
      // Arrange: Entity cached in Redis
      // Act: Load entity
      // Assert: Retrieved from Redis (no DB query)
    })

    it('should handle Redis connection failure gracefully', async () => {
      // Arrange: Redis down
      // Act: Load entity
      // Assert: Falls back to database (no error)
    })

    it('should serialize/deserialize complex entities', async () => {
      // Arrange: Entity with Date, nested objects
      // Act: Cache in Redis, retrieve
      // Assert: Correctly deserialized
    })
  })
})
```

##### Day 7: Performance & Concurrency

```typescript
// e2e-tests/tests/performance.test.ts
describe('Performance Benchmarks', () => {
  describe('Insert Performance', () => {
    it('should insert 10k entities in < 5s (batch)', async () => {
      // Arrange: Generate 10k test entities
      // Act: BatchOperations.bulkInsert()
      // Assert: Duration < 5000ms
    })

    it('should insert 1k entities in < 2s (saveChanges)', async () => {
      // Arrange: Add 1k entities to ChangeTracker
      // Act: saveChanges()
      // Assert: Duration < 2000ms
    })
  })

  describe('Query Performance', () => {
    it('should query 10k entities with pagination in < 1s', async () => {
      // Arrange: 10k entities in database
      // Act: Query with skip(5000).take(100)
      // Assert: Duration < 1000ms
    })

    it('should execute count() on 100k entities in < 500ms', async () => {
      // Arrange: 100k entities
      // Act: Execute count()
      // Assert: Duration < 500ms
    })
  })

  describe('Update Performance', () => {
    it('should update 10k entities in < 5s (batch)', async () => {
      // Arrange: 10k entities
      // Act: BatchOperations.bulkUpdate()
      // Assert: Duration < 5000ms
    })
  })

  describe('Concurrency', () => {
    it('should handle 100 concurrent read queries', async () => {
      // Arrange: Database with data
      // Act: Execute 100 queries in parallel
      // Assert: All succeed, pool handles load
    })

    it('should handle 50 concurrent write operations', async () => {
      // Arrange: Empty database
      // Act: Insert 50 entities concurrently
      // Assert: All succeed, no conflicts
    })

    it('should respect connection pool limits', async () => {
      // Arrange: Pool max size = 10
      // Act: Execute 100 queries concurrently
      // Assert: Only 10 concurrent connections
    })
  })

  describe('Cache Performance', () => {
    it('should achieve >90% cache hit rate for repeated queries', async () => {
      // Arrange: Execute 100 identical queries
      // Act: Track cache hits
      // Assert: Hit rate > 90%
    })
  })
})

// e2e-tests/tests/transactions.test.ts
describe('Transactions & Isolation', () => {
  describe('Transaction Semantics', () => {
    it('should commit all changes together', async () => {
      // Arrange: 3 entities to insert
      // Act: Add all, saveChanges()
      // Assert: All visible in database
    })

    it('should rollback all changes on error', async () => {
      // Arrange: 2 valid + 1 invalid entity
      // Act: saveChanges() (fails on 3rd)
      // Assert: First 2 also rolled back
    })

    it('should support nested transactions (savepoints)', async () => {
      // Arrange: Outer transaction
      // Act: Create savepoint, insert, rollback to savepoint
      // Assert: Inner rollback, outer still active
    })

    it('should respect transaction isolation level', async () => {
      // Arrange: Set isolation to READ COMMITTED
      // Act: Concurrent transactions
      // Assert: Reads see committed data only
    })
  })

  describe('Deadlock Handling', () => {
    it('should detect and resolve deadlocks', async () => {
      // Arrange: 2 transactions with conflicting locks
      // Act: Execute both
      // Assert: One succeeds, one retries or throws
    })

    it('should retry on deadlock detection', async () => {
      // Arrange: RetryPolicy configured
      // Act: Trigger deadlock
      // Assert: Transaction retried automatically
    })
  })
})
```

##### Day 8: Middleware & Telemetry

```typescript
// e2e-tests/tests/middleware.test.ts
describe('Middleware Integration', () => {
  describe('SQL Logging', () => {
    it('should log all SQL queries', async () => {
      // Arrange: Configure SQL logger
      // Act: Execute query
      // Assert: Logger received SQL + parameters
    })

    it('should log query duration', async () => {
      // Arrange: Configure logger with metrics
      // Act: Execute query
      // Assert: Duration logged
    })

    it('should log errors', async () => {
      // Arrange: Configure error logger
      // Act: Execute invalid query
      // Assert: Error logged with details
    })
  })

  describe('Metrics Collection', () => {
    it('should track query count by type', async () => {
      // Arrange: Execute various queries (SELECT, INSERT, UPDATE, DELETE)
      // Act: Retrieve metrics
      // Assert: Counters incremented correctly
    })

    it('should track cache hit/miss ratio', async () => {
      // Arrange: Execute queries (some hit cache, some miss)
      // Act: Retrieve cache metrics
      // Assert: Hit ratio calculated correctly
    })

    it('should track entity materialization count', async () => {
      // Arrange: Execute queries that return entities
      // Act: Retrieve metrics
      // Assert: Materialization count correct
    })
  })

  describe('Audit Trail', () => {
    it('should record createdAt timestamp', async () => {
      // Arrange: Insert entity with audit enabled
      // Act: Load entity
      // Assert: createdAt populated
    })

    it('should record updatedAt on modification', async () => {
      // Arrange: Update entity
      // Act: Load entity
      // Assert: updatedAt > createdAt
    })

    it('should record user context in audit fields', async () => {
      // Arrange: Set user context, insert entity
      // Act: Load entity
      // Assert: createdBy = user ID
    })
  })

  describe('Soft Delete', () => {
    it('should mark entity as deleted instead of removing', async () => {
      // Arrange: Insert entity
      // Act: Delete entity with soft-delete enabled
      // Assert: Entity still in DB with isDeleted = true
    })

    it('should filter deleted entities from queries', async () => {
      // Arrange: 5 active + 3 deleted entities
      // Act: Query all
      // Assert: Returns only 5 active
    })

    it('should include deleted entities with option', async () => {
      // Arrange: Active + deleted entities
      // Act: Query with includeDeleted option
      // Assert: Returns all entities
    })
  })
})
```

---

## Shared Test Utilities

Create in `packages/testkits`:

### Fixtures

```typescript
// testkits/src/fixtures.ts
export function createUser(overrides?: Partial<User>): User
export function createOrder(user: User, overrides?: Partial<Order>): Order
export function createProduct(overrides?: Partial<Product>): Product
export function createEntityBatch<T>(factory: () => T, count: number): T[]
export function createRelatedEntities(userCount: number, ordersPerUser: number): { users: User[], orders: Order[] }
```

### Mock Provider

```typescript
// testkits/src/mock-provider.ts
export class MockDatabaseProvider extends DatabaseProvider {
  // Track all method calls
  public calls: { method: string, args: unknown[] }[]

  // Configure custom responses
  public respondWith<T>(method: string, response: T): void

  // Simulate errors
  public throwOn(method: string, error: Error): void

  // Reset mock state
  public reset(): void
}
```

### Metadata Reset

```typescript
// testkits/src/metadata-reset.ts
export function resetMetadata(): void
export function isolateMetadata(fn: () => void | Promise<void>): Promise<void>
export function clearPendingMetadata(): void
```

### Database Containers

```typescript
// testkits/src/db-containers.ts
export interface TestDatabase {
  connectionString: string
  provider: DatabaseProvider
  stop(): Promise<void>
}

export async function startPostgres(): Promise<TestDatabase>
export async function startMySQL(): Promise<TestDatabase>
export async function startMSSQL(): Promise<TestDatabase>
export async function startSQLite(): Promise<TestDatabase>
export async function stopAllContainers(): Promise<void>
```

### Assertion Helpers

```typescript
// testkits/src/assertions.ts
export function assertEntityEquals<T>(actual: T, expected: T, compareIds?: boolean): void
export function assertSqlMatches(sql: string, pattern: RegExp): void
export function assertMetadataRegistered(entityClass: Function): void
export function assertChangeTrackerState(tracker: ChangeTracker, expectedState: Record<object, EntityState>): void
export function assertTransactionActive(provider: DatabaseProvider): void
```

---

## Complexity Estimation

| Tier | Packages | Dev-Days | Priority |
|------|----------|----------|----------|
| Tier 0 | types, config, ast, sql-visitor, metrics-safe, testkits | 4 | 🔴 Critical |
| Tier 1 | core, query, orm, metadata, migrations | 12 | 🔴 Critical |
| Tier 2 | dialects (4 @ 2d), providers (4 @ 0.5d), cache (3 @ 0.5d), concurrency, pagination, telemetry (4 @ 0.75d) | 11 | 🟠 High |
| Tier 3 | plugins (3 @ 2d), CLI, integration-nestjs, examples, composite-sql-logger | 7 | 🟡 Medium |
| E2E | e2e-tests (infrastructure + 8 test suites) | 9 | 🔴 Critical |
| **TOTAL** | **35 packages** | **43 days** | |

### Detailed Breakdown

**Tier 0 (4 days):**
- types: 0.5d
- config: 0.5d
- ast: 0.5d
- sql-visitor: 0.5d
- metrics-safe: 0.5d
- testkits: 1.5d

**Tier 1 (12 days):**
- metadata: 2d
- core: 3d
- query: 3d
- orm: 2d
- migrations: 2d

**Tier 2 (11 days):**
- dialect-sqlite: 2d
- dialect-postgres: 2d
- dialect-mysql: 2d
- dialect-mssql: 2d
- provider-sqlite: 0.5d
- provider-postgres: 0.5d
- provider-mysql: 0.5d
- provider-mssql: 0.5d
- cache + cache-redis + cache-memcached: 0.5d
- concurrency: 0.5d
- pagination: 0.25d
- telemetry + prometheus-sql-logger + open-telemetry-sql-logger + composite-sql-logger: 0.75d

**Tier 3 (7 days):**
- plugin-audit: 0.75d
- plugin-multi-tenant: 0.75d
- plugin-soft-delete: 0.5d
- cli: 2d
- integration-nestjs: 1d
- examples: 1d
- composite-sql-logger: (included in Tier 2 telemetry)

**E2E (9 days):**
- Infrastructure setup: 1d
- CRUD + Change Tracking: 2d
- LINQ Queries: 1d
- Relationships: 1d
- Migrations: 1d
- Caching: 1d
- Performance + Concurrency: 1d
- Middleware + Telemetry: 1d

---

## Execution Plan

### Phase 1: Preparation & Foundation (2 days)

**Day 1:**
1. ✅ Create shared test utilities in testkits
2. ✅ Configure Vitest for all packages
3. ✅ Set up docker-compose for E2E databases
4. ✅ Create fixture factories

**Day 2:**
5. ✅ Implement mock DatabaseProvider
6. ✅ Create metadata reset utilities
7. ✅ Build database container helpers
8. ✅ Implement assertion helpers

### Phase 2: Tier 0 - Foundation Packages (4 days)

**Day 3-4:**
9. ✅ Delete old tests in types, config, ast, sql-visitor, metrics-safe
10. ✅ Write unit tests for all Tier 0 packages
11. ✅ Verify test harness works correctly

### Phase 3: Tier 1 - Core ORM (12 days)

**Day 5-16:**
12. ✅ Delete old tests in metadata, core, query, orm, migrations
13. ✅ Write comprehensive unit tests for metadata package (2d)
14. ✅ Write comprehensive unit tests for core package (3d)
15. ✅ Write comprehensive unit tests for query package (3d)
16. ✅ Write comprehensive unit tests for orm package (2d)
17. ✅ Write comprehensive unit tests for migrations package (2d)
18. ✅ Ensure 100% coverage of critical paths

### Phase 4: Tier 2 - Adapters & Utilities (11 days)

**Day 17-27:**
19. ✅ Delete old tests in all dialect packages
20. ✅ Write SQL generation tests for all 4 dialects (8d)
21. ✅ Write provider tests for all 4 providers (2d)
22. ✅ Write cache, concurrency, pagination, telemetry tests (1d)

### Phase 5: Tier 3 - Plugins & Integrations (7 days)

**Day 28-34:**
23. ✅ Delete old tests in plugins, CLI, integrations
24. ✅ Write plugin tests (audit, multi-tenant, soft-delete) (2d)
25. ✅ Write CLI tests (2d)
26. ✅ Write integration-nestjs tests (1d)
27. ✅ Write examples validation tests (1d)

### Phase 6: E2E Tests (9 days)

**Day 35:**
28. ✅ Set up E2E infrastructure (Docker, test databases)
29. ✅ Verify all databases reachable and healthy

**Day 36-37:**
30. ✅ Write CRUD workflow tests for all 4 providers
31. ✅ Write change tracking tests

**Day 38:**
32. ✅ Write LINQ query tests (basic + advanced)

**Day 39:**
33. ✅ Write relationship + lazy loading tests

**Day 40:**
34. ✅ Write migration tests (up/down/rollback)

**Day 41:**
35. ✅ Write caching tests (SQL cache, L2 cache, Redis)

**Day 42:**
36. ✅ Write performance benchmarks
37. ✅ Write concurrency + transaction tests

**Day 43:**
38. ✅ Write middleware + telemetry tests

### Phase 7: Finalization (1 day)

**Day 44:**
39. ✅ Run full test suite across all packages
40. ✅ Check coverage reports (aim for >90%)
41. ✅ Fix any remaining test failures
42. ✅ Update CI/CD pipeline configuration
43. ✅ Document test patterns and best practices
44. ✅ Generate final coverage report

---

## Success Criteria

- ✅ **Zero existing tests remaining** in all packages
- ✅ **>90% code coverage** across all packages
- ✅ **All edge cases tested** (error handling, null checks, boundary conditions)
- ✅ **E2E tests pass** against all 4 database providers (SQLite, PostgreSQL, MySQL, MSSQL)
- ✅ **Performance benchmarks met**:
  - 10k batch insert < 5s
  - 10k batch update < 5s
  - 10k query with pagination < 1s
  - 100k count() < 500ms
- ✅ **CI/CD pipeline green** with all tests passing
- ✅ **Test execution time**:
  - Unit tests: < 5 minutes
  - E2E tests: < 10 minutes
- ✅ **All packages tested** (35/35)
- ✅ **Documentation updated** with testing guidelines

---

## Notes

### Testing Best Practices

- Tests use **Vitest** framework for fast, parallel execution
- All tests must be **isolated** (no shared state between tests)
- Use **deterministic fixtures** for reproducible test results
- **Reset metadata** between tests via `MetadataStorage.reset()`
- **Cleanup database connections** in `afterEach`/`afterAll` hooks
- E2E tests require **Docker** for database containers
- Use **test.concurrent** for independent test parallelization where safe
- Use **snapshot testing** for SQL generation validation
- Implement **custom matchers** for domain-specific assertions
- Use **describe.each** for parameterized tests across providers
- Use **beforeAll**/**afterAll** for expensive setup/teardown
- Use **mock timers** for time-dependent tests
- **Avoid test interdependencies** - each test should be runnable in isolation

### Coverage Goals

- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

### CI/CD Integration

- Run unit tests on every commit
- Run E2E tests on PR to main branch
- Generate coverage reports automatically
- Fail build if coverage drops below threshold
- Cache node_modules and Turbo builds
- Run tests in parallel across packages
- Use Docker Compose for E2E database setup

---

**Last Updated:** November 10, 2025  
**Status:** Ready for Implementation  
**Total Estimated Effort:** 43 dev-days (revised from 38)  
**Total Packages:** 35  
**Total Expected Tests:** ~800-1000 test cases
