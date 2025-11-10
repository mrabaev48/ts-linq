# 📋 Comprehensive Testing Plan for TypeScript ORM Framework

## 📖 Table of Contents

- [Overview](#overview)
- [Testing Strategy](#testing-strategy)
- [Tier 0: Foundation Packages](#tier-0-foundation-packages-2-days)
- [Tier 1: Core ORM Packages](#tier-1-core-orm-packages-12-days)
- [Tier 2: Adapters and Utilities](#tier-2-adapters-and-utilities-10-days)
- [Tier 3: Plugins and Integrations](#tier-3-plugins-and-integrations-6-days)
- [E2E Tests](#e2e-tests-8-days)
- [Shared Test Utilities](#shared-test-utilities)
- [Complexity Estimation](#complexity-estimation)
- [Execution Plan](#execution-plan)

---

## Overview

This document outlines a comprehensive testing plan for complete test suite rewrite of the TypeScript ORM framework covering all 35 packages with 241 existing test files to be deleted and rewritten from scratch.

### Goals

1. **Delete ALL existing tests** from `packages/*/tests` folders
2. **Write comprehensive unit tests** for each package covering:
   - All classes, functions, methods
   - All edge cases and error conditions
   - Happy paths and failure scenarios
   - Type safety validation
   - Decorator functionality (legacy experimental decorators with reflect-metadata)

3. **Write new E2E tests** in `packages/e2e-tests` covering:
   - Full CRUD workflows
   - Multi-database provider testing (SQLite, PostgreSQL, MySQL, MSSQL)
   - Change tracking and transactions
   - Query building (LINQ-style queries)
   - Relationships and lazy loading
   - Migration scenarios
   - Performance and caching

### Framework

- **Testing Framework**: Vitest (currently in use)
- **Total Effort**: ~38 dev-days
- **Target Coverage**: >90%

---

## Testing Strategy

### Phased Approach

Execute a phased test-suite rewrite that begins with foundational shared packages, then the core ORM surface, followed by adapters/providers, finishing with plugins and E2E validation across all databases.

### Prioritization by Dependency Tiers

- **Tier 0** (types, testkits): Establish shared contracts/mocks
- **Tier 1** (core, query, orm, metadata, migrations): CRUD, change tracking, decorators, LINQ, schema evolution
- **Tier 2** (dialects, providers, cache, concurrency, telemetry): SQL generation, connection lifecycles, retry/caching
- **Tier 3** (plugins, integrations, CLI, examples): Extension points and developer tooling

### Test Structure

For each package, define Vitest `describe` blocks mirroring each class/function with:
- Arrange/Act/Assert helpers
- Exhaustive branch coverage (happy path, error/edge cases, type guards)
- Decorator metadata validation
- Legacy decorator emit ordering verification
- Snapshot baselines where SQL/metadata outputs matter

### Isolated State Management

- Use `beforeEach`/`afterEach` for cleanup
- Call `MetadataStorage.reset()` between tests
- Teardown providers and database connections
- Reset cache instances
- Clear global state

---

## TIER 0: Foundation Packages (2 days)

### 1. `packages/types` (0.5 day)

#### What to Test

- ✅ Type exports and TypeScript compilation
- ✅ Brand types (PrimaryKeyOf, branded IDs)
- ✅ Utility types (EntityState, LoadingStrategy, etc.)

#### Test Files

```typescript
// types/tests/brand-types.test.ts
describe('Brand Types', () => {
  it('should create branded primary key types')
  it('should enforce type safety at compile time')
  it('should work with generic constraints')
})

// types/tests/entity-state.test.ts
describe('EntityState', () => {
  it('should export all EntityState values')
  it('should type-check state transitions')
})
```

---

### 2. `packages/testkits` (1.5 days)

#### What to Test

- ✅ Fixture factories for entities
- ✅ Mock provider implementations
- ✅ Test database setup helpers
- ✅ Decorator reset utilities

#### Test Files

```typescript
// testkits/tests/fixtures.test.ts
describe('Fixture Factories', () => {
  it('should generate deterministic entity fixtures')
  it('should support custom field overrides')
  it('should create related entities with FK integrity')
  it('should handle circular relationships')
})

// testkits/tests/mock-provider.test.ts
describe('MockDatabaseProvider', () => {
  it('should implement all DatabaseProvider methods')
  it('should track method calls for verification')
  it('should support custom query responses')
  it('should simulate connection failures')
})

// testkits/tests/metadata-reset.test.ts
describe('Metadata Reset Utilities', () => {
  it('should clear MetadataStorage between tests')
  it('should restore decorator registrations')
  it('should handle pending metadata cleanup')
})
```

#### Output

Shared test harness for all packages.

---

## TIER 1: Core ORM Packages (12 days)

### 3. `packages/metadata` (2 days)

#### Classes to Test

- `@Entity`, `@Column`, `@PrimaryKey`
- `@ComputedColumn`, `@DatabaseFunction`
- `@OneToMany`, `@ManyToOne`, `@OneToOne`, `@ManyToMany`
- `@ValidIf`, `@RequiredIfOf`, `@MinLengthOf`, `@MaxLengthOf`, `@PatternOf`, `@RangeOf`
- `@CachePolicy`
- `MetadataStorage`

#### Unit Tests

```typescript
// metadata/tests/entity-decorator.test.ts
describe('@Entity Decorator', () => {
  it('should register entity with default table name')
  it('should use custom table name from options')
  it('should handle Stage-3 decorator context')
  it('should throw if not Stage-3 decorator')
  it('should restore metadata after clear()')
})

// metadata/tests/column-decorator.test.ts
describe('@Column Decorator', () => {
  it('should register column with default settings')
  it('should respect nullable option (default true)')
  it('should set column name override')
  it('should handle type, length, precision, scale')
  it('should mark generated/version columns')
  it('should throw for non-Stage-3 context')
})

// metadata/tests/primary-key-decorator.test.ts
describe('@PrimaryKey Decorator', () => {
  it('should register as column + primary key')
  it('should default to INTEGER type')
  it('should support autoIncrement option')
  it('should mark as non-nullable')
  it('should support branded primary keys')
  it('should update metadata for brand property')
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
})

// metadata/tests/metadata-storage.test.ts
describe('MetadataStorage', () => {
  it('should store entity metadata globally')
  it('should retrieve entity by constructor')
  it('should add columns incrementally')
  it('should add primary keys to list')
  it('should store relationships')
  it('should store validation rules')
  it('should clear all metadata')
  it('should handle missing entity gracefully')
})
```

#### Edge Cases

- Duplicate decorator application
- Missing constructor context
- Circular relationship references
- Invalid validation predicates

---

### 4. `packages/core` (3 days)

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

#### Unit Tests

```typescript
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
})

// core/tests/ddl-builder.test.ts
describe('DdlBuilder', () => {
  it('should generate CREATE TABLE statement')
  it('should generate CREATE INDEX statements')
  it('should handle primary keys')
  it('should handle foreign keys')
  it('should respect column constraints')
  it('should support computed columns')
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
})

// core/tests/retry-policy.test.ts
describe('ExponentialBackoffRetryPolicy', () => {
  it('should retry transient failures')
  it('should use exponential backoff')
  it('should respect max retries')
  it('should not retry permanent errors')
  it('should apply jitter to backoff')
})

// core/tests/global-filter-applier.test.ts
describe('GlobalFilterApplier', () => {
  it('should apply soft-delete filter')
  it('should apply custom global filters')
  it('should combine multiple filters with AND')
  it('should skip filter if entity lacks column')
  it('should not modify original model (immutable)')
})
```

#### Edge Cases

- Concurrent lazy loading requests
- Cache eviction under memory pressure
- Retry exhaustion scenarios
- Null/undefined handling in batch operations

---

### 5. `packages/query` (3 days)

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
})

// query/tests/include-planner.test.ts
describe('IncludePlanner', () => {
  it('should populate includes for entity array')
  it('should skip if no entity loader')
  it('should skip if limit === 1')
  it('should call entity loader with includes')
  it('should respect depth option')
})

// query/tests/join-predicate-parser.test.ts
describe('JoinPredicateParser', () => {
  it('should parse join ON condition')
  it('should extract left/right table references')
  it('should generate SQL ON clause')
  it('should handle complex join predicates')
})
```

#### Edge Cases

- Empty result sets
- Null/undefined in WHERE clauses
- Invalid lambda expressions
- Cache key collisions
- Type conversion edge cases (null, undefined, empty string)

---

### 6. `packages/orm` (2 days)

#### Classes to Test

- `DbContext`
- `DbSet<T>`
- `ChangeTracker`

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
})
```

#### Edge Cases

- Empty ChangeTracker (saveChanges no-op)
- Concurrent entity modifications
- Missing primary key on insert
- Version field not set (concurrency check skipped)
- Circular entity references in add()

---

### 7. `packages/migrations` (2 days)

#### Classes to Test

- `Migration` (abstract)
- `MigrationRunner`
- `DiffBasedMigration`
- `MigrationBuilder`
- Schema diff utilities

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
})

// migrations/tests/diff-based-migration.test.ts
describe('DiffBasedMigration', () => {
  it('should generate up/down SQL from SchemaDiff')
  it('should execute up() statements in order')
  it('should execute down() statements in order')
  it('should call lifecycle hooks (before/after)')
  it('should skip statement if beforeStatement hook returns false')
  it('should use correct dialect for SQL generation')
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
})

// migrations/tests/schema-diff.test.ts
describe('Schema Diff', () => {
  it('should detect table additions')
  it('should detect table deletions')
  it('should detect column additions')
  it('should detect column modifications')
  it('should detect column deletions')
  it('should detect index changes')
  it('should detect foreign key changes')
  it('should detect table renames')
  it('should detect column renames')
})
```

#### Edge Cases

- Empty migration (no-op)
- Migration order conflicts
- Rollback of non-reversible migrations
- Schema diff for complex changes

---

## TIER 2: Adapters and Utilities (10 days)

### 8. Dialect Packages (2 days each = 8 days)

#### Packages

- `dialect-sqlite`
- `dialect-postgres`
- `dialect-mysql`
- `dialect-mssql`

#### What to Test for Each Dialect

```typescript
// dialect-X/tests/X-dialect.test.ts
describe('SQLDialect', () => {
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
})
```

#### Edge Cases

- SQL injection via identifiers
- Reserved keyword collisions
- Case sensitivity differences
- Unicode/special characters in names
- Large parameter lists (> 999 for SQLite)

---

### 9. Provider Packages (0.5 day each = 2 days)

#### Packages

- `provider-sqlite`
- `provider-postgres`
- `provider-mysql`
- `provider-mssql`

#### What to Test for Each Provider

```typescript
// provider-X/tests/X-provider.test.ts
describe('DatabaseProvider', () => {
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
})

// provider-X/tests/error-mapping.test.ts
describe('Error Mapping', () => {
  it('should map unique constraint violation')
  it('should map foreign key violation')
  it('should map not null violation')
  it('should map connection timeout')
  it('should map deadlock detection')
  it('should map generic database error')
})
```

#### Edge Cases

- Connection loss during query
- Pool exhaustion
- Transaction deadlocks
- Type conversion errors
- Large result sets (memory management)

---

## TIER 3: Plugins and Integrations (6 days)

### 10. `packages/cache`, `cache-redis`, `cache-memcached` (1 day)

```typescript
// cache/tests/entity-cache.test.ts
describe('EntityCache', () => {
  it('should cache entity by class + ID')
  it('should retrieve cached entity')
  it('should evict entity')
  it('should clear all entries')
  it('should respect TTL')
  it('should handle cache misses')
})

// cache-redis/tests/redis-cache.test.ts
describe('RedisCache', () => {
  it('should connect to Redis')
  it('should cache entities in Redis')
  it('should serialize/deserialize entities')
  it('should support TTL expiration')
  it('should handle Redis connection errors')
  it('should fall back gracefully on failure')
})

// cache-memcached/tests/memcached-cache.test.ts
describe('MemcachedCache', () => {
  it('should connect to Memcached')
  it('should cache entities')
  it('should handle serialization')
  it('should support TTL')
  it('should handle connection errors')
})
```

---

### 11. `packages/concurrency` (0.5 day)

```typescript
// concurrency/tests/optimistic-concurrency.test.ts
describe('Optimistic Concurrency', () => {
  it('should detect concurrent modification via version field')
  it('should throw ConcurrencyError on version mismatch')
  it('should increment version on successful update')
  it('should handle missing version field gracefully')
})
```

---

### 12. `packages/cli` (2 days)

```typescript
// cli/tests/migration-commands.test.ts
describe('Migration Commands', () => {
  it('should generate migration file')
  it('should run pending migrations')
  it('should rollback last migration')
  it('should show migration status')
  it('should handle command-line arguments')
  it('should display help text')
  it('should support config file')
})

// cli/tests/codegen.test.ts
describe('Code Generation', () => {
  it('should scaffold entity classes')
  it('should generate migration from diff')
  it('should generate TypeScript types')
})
```

---

### 13. `packages/telemetry`, `prometheus-sql-logger`, `open-telemetry-sql-logger` (1 day)

```typescript
// telemetry/tests/telemetry-integration.test.ts
describe('Telemetry Integration', () => {
  it('should collect query metrics')
  it('should collect cache metrics')
  it('should collect error metrics')
  it('should export metrics to collector')
})

// prometheus-sql-logger/tests/prometheus-logger.test.ts
describe('PrometheusLogger', () => {
  it('should expose Prometheus metrics endpoint')
  it('should track query duration histogram')
  it('should track query counter')
  it('should track cache hit ratio')
})

// open-telemetry-sql-logger/tests/otel-logger.test.ts
describe('OpenTelemetryLogger', () => {
  it('should create spans for queries')
  it('should attach attributes to spans')
  it('should propagate context')
  it('should export traces to collector')
})
```

---

### 14. Plugins (1.5 days)

```typescript
// plugin-audit/tests/audit-plugin.test.ts
describe('Audit Plugin', () => {
  it('should set createdAt on insert')
  it('should set updatedAt on update')
  it('should set createdBy/updatedBy if user provided')
  it('should respect audit options')
})

// plugin-multi-tenant/tests/multi-tenant-plugin.test.ts
describe('Multi-Tenant Plugin', () => {
  it('should filter queries by tenant ID')
  it('should inject tenant ID on insert')
  it('should prevent cross-tenant access')
  it('should support tenant context')
})

// plugin-soft-delete/tests/soft-delete-plugin.test.ts
describe('Soft Delete Plugin', () => {
  it('should mark entity as deleted (soft delete)')
  it('should filter deleted entities from queries')
  it('should support hard delete option')
  it('should support restore functionality')
})
```

---

## E2E Tests (8 days)

### `packages/e2e-tests` - End-to-End Testing

#### Infrastructure Setup (1 day)

Create `docker-compose.yml` for test databases:

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5432:5432"

  mysql:
    image: mysql:8
    environment:
      MYSQL_DATABASE: test
      MYSQL_USER: test
      MYSQL_PASSWORD: test
      MYSQL_ROOT_PASSWORD: root
    ports:
      - "3306:3306"

  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: Y
      SA_PASSWORD: YourStrong@Passw0rd
    ports:
      - "1433:1433"
```

#### E2E Test Scenarios (7 days)

```typescript
// e2e-tests/tests/crud-workflows.test.ts
describe('CRUD Workflows', () => {
  it('should perform full CRUD cycle (SQLite)')
  it('should perform full CRUD cycle (PostgreSQL)')
  it('should perform full CRUD cycle (MySQL)')
  it('should perform full CRUD cycle (MSSQL)')
  it('should handle batch operations')
  it('should support transactions with rollback')
  it('should detect optimistic concurrency conflicts')
})

// e2e-tests/tests/change-tracking.test.ts
describe('Change Tracking', () => {
  it('should track Added entities')
  it('should track Modified entities')
  it('should detect modified properties')
  it('should track Deleted entities')
  it('should save all changes in single transaction')
  it('should rollback all changes on error')
})

// e2e-tests/tests/linq-queries.test.ts
describe('LINQ Queries', () => {
  it('should execute WHERE queries')
  it('should execute complex predicates')
  it('should execute ORDER BY queries')
  it('should execute LIMIT/OFFSET pagination')
  it('should execute GROUP BY with HAVING')
  it('should execute INNER JOIN')
  it('should execute LEFT JOIN')
  it('should execute UNION queries')
  it('should execute subqueries')
  it('should use query cache')
})

// e2e-tests/tests/relationships.test.ts
describe('Relationships', () => {
  it('should load one-to-many relationships (eager)')
  it('should load many-to-one relationships (eager)')
  it('should load one-to-one relationships')
  it('should load many-to-many with junction table')
  it('should lazy load on proxy access')
  it('should batch load to prevent N+1')
  it('should handle circular relationships')
  it('should cascade delete relationships')
})

// e2e-tests/tests/migrations.test.ts
describe('Migrations', () => {
  it('should run initial migration')
  it('should apply pending migrations in order')
  it('should rollback last migration')
  it('should rollback to target version')
  it('should detect schema drift')
  it('should generate diff-based migration')
  it('should handle migration errors (rollback)')
})

// e2e-tests/tests/caching.test.ts
describe('Caching', () => {
  it('should cache SQL queries')
  it('should cache count results')
  it('should cache entities (L2)')
  it('should invalidate cache on save')
  it('should warm cache from entries')
  it('should evict on TTL expiration')
  it('should use Redis cache if configured')
})

// e2e-tests/tests/performance.test.ts
describe('Performance', () => {
  it('should insert 10k entities in batches (< 5s)')
  it('should query 10k entities with pagination (< 1s)')
  it('should update 10k entities in batches (< 5s)')
  it('should handle 100 concurrent queries')
  it('should respect connection pool limits')
  it('should cache repeated queries efficiently')
})

// e2e-tests/tests/middleware.test.ts
describe('Middleware', () => {
  it('should log SQL queries via middleware')
  it('should track metrics via middleware')
  it('should execute before/after hooks')
  it('should notify on entity materialization')
  it('should apply audit metadata')
  it('should apply soft-delete filter')
})

// e2e-tests/tests/multi-provider.test.ts
describe('Multi-Provider', () => {
  it('should run same test suite against all providers')
  it('should produce consistent results across providers')
  it('should handle provider-specific features')
  it('should respect dialect differences')
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
export function createEntityBatch<T>(factory: () => T, count: number): T[]
```

### Mock Provider

```typescript
// testkits/src/mock-provider.ts
export class MockDatabaseProvider extends DatabaseProvider {
  // Implement all abstract methods
  // Track method calls for assertions
}
```

### Metadata Reset

```typescript
// testkits/src/metadata-reset.ts
export function resetMetadata(): void
export function isolateMetadata(fn: () => void): void
```

### Database Containers

```typescript
// testkits/src/db-containers.ts
export async function startPostgres(): Promise<TestDatabase>
export async function startMySQL(): Promise<TestDatabase>
export async function startMSSQL(): Promise<TestDatabase>
export async function stopAllContainers(): Promise<void>
```

### Test Helpers

```typescript
// testkits/src/test-helpers.ts
export function assertEntityEquals(actual: T, expected: T): void
export function assertSqlMatches(sql: string, pattern: RegExp): void
export function assertMetadataRegistered(entityClass: Function): void
```

---

## Complexity Estimation

| Tier | Packages | Dev-Days | Priority |
|------|----------|----------|----------|
| Tier 0 | types, testkits | 2 | 🔴 Critical |
| Tier 1 | core, query, orm, metadata, migrations | 12 | 🔴 Critical |
| Tier 2 | dialects (4), providers (4), cache (3), concurrency | 10 | 🟠 High |
| Tier 3 | plugins (3), CLI, telemetry (3), integrations | 6 | 🟡 Medium |
| E2E | e2e-tests | 8 | 🔴 Critical |
| **TOTAL** | **35 packages** | **38 days** | |

---

## Execution Plan

### Phase 1: Preparation (1 day)

1. ✅ Create shared test utilities in testkits
2. ✅ Configure docker-compose for E2E databases
3. ✅ Create fixture factories
4. ✅ Set up Vitest configuration

### Phase 2: Tier 0 - Foundation Packages (2 days)

4. ✅ Delete old tests in types, testkits
5. ✅ Write new unit tests
6. ✅ Verify test harness is ready

### Phase 3: Tier 1 - Core ORM (12 days)

7. ✅ Delete old tests in metadata, core, query, orm, migrations
8. ✅ Write comprehensive unit tests with edge cases
9. ✅ Ensure 100% coverage of critical paths

### Phase 4: Tier 2 - Adapters (10 days)

10. ✅ Delete old tests in dialects, providers, cache, concurrency
11. ✅ Write provider-specific tests
12. ✅ Test SQL generation for all dialects

### Phase 5: Tier 3 - Plugins (6 days)

13. ✅ Delete old tests in plugins, CLI, telemetry
14. ✅ Write integration tests
15. ✅ Validate plugin functionality

### Phase 6: E2E Tests (8 days)

16. ✅ Delete old e2e tests
17. ✅ Write new E2E scenarios with real databases
18. ✅ Run smoke tests for all providers
19. ✅ Validate performance benchmarks

### Phase 7: Finalization (1 day)

20. ✅ Run full test suite
21. ✅ Check coverage (aim for >90%)
22. ✅ Update CI/CD pipeline
23. ✅ Document test patterns

---

## Success Criteria

- ✅ **Zero existing tests remaining** in all packages
- ✅ **>90% code coverage** across all packages
- ✅ **All edge cases tested** (error handling, null checks, boundary conditions)
- ✅ **E2E tests pass** against all 4 database providers
- ✅ **Performance benchmarks met** (10k entities < 5s)
- ✅ **CI/CD pipeline green** with all tests passing
- ✅ **Test execution time** < 5 minutes for unit tests, < 10 minutes for E2E

---

## Notes

- Tests use **Vitest** framework for fast, parallel execution
- All tests must be **isolated** (no shared state between tests)
- Use **deterministic fixtures** for reproducible test results
- **Reset metadata** between tests to avoid cross-contamination
- **Cleanup database connections** in afterEach/afterAll hooks
- E2E tests require **Docker** for database containers
- Consider using **test.concurrent** for independent test parallelization
- Use **snapshot testing** for SQL generation validation
- Implement **custom matchers** for common assertions

---

**Last Updated:** November 10, 2025  
**Status:** Ready for Implementation  
**Total Estimated Effort:** 38 dev-days
