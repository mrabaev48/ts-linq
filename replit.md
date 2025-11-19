# Overview

This project is a TypeScript ORM framework, inspired by Entity Framework Core, providing a code-first approach to database management. It utilizes TypeScript legacy experimental decorators for entity definitions, offers LINQ-style query building, and supports multiple database providers (SQLite, PostgreSQL, MySQL, MSSQL). The framework emphasizes type safety, change tracking, and adheres to SOLID principles, aiming to be a robust and developer-friendly ORM solution for TypeScript applications.

## Recent Testing Progress

### 🎯 November 19, 2025: Critical Production Features Migration

**MemoryFallback Re-Implementation** ✅  
Discovered and fixed critical architectural gap: MemoryFallback class was missing despite graceful degradation API existing in codebase. Implemented production-ready solution:
- **Location**: packages/query/src/fallbacks/MemoryFallback.ts
- **Unit Tests**: 12 tests (caching, async suppliers, refresh intervals, offset/limit)
- **Status**: Build passing, fully functional ✅

**Critical Tests Migration from tests-old** (45 tests migrated)  
Systematically migrated ~20 production features from legacy test files:
- ✅ Circuit Breaker (9 tests): Force open/close, half-open concurrency, error thresholds
- ✅ Specification Pattern (18 tests in ast/tests): Already covered, no migration needed
- ✅ Prometheus Metrics (16 tests): SqlLogger, query analysis, /metrics endpoint
- ✅ Property-Based Testing (8 tests): Keyset pagination correctness, predicate SQL/JS equivalence
- ✅ MemoryFallback (12 tests): Core graceful degradation infrastructure
- ⏳ Graceful Degradation (9 files, ~40 tests): Deferred for follow-up (hedged queries, fallback policies, throttling)

**New Tests Total**: +45 critical production feature tests

### 🎉 TIER 1 COMPLETE - ALL PACKAGES APPROVED ✅

### ✅ Migrations Package Testing Complete (74 tests)
**Files:** 
- MigrationBuilder.test.ts (26 tests) - Schema operations, table/column/index/FK management
- MigrationRunner.test.ts (26 tests) - Transaction flows, migrate/rollback execution pipeline
- DiffBasedMigration.test.ts (22 tests) - Template Method hooks, SQL generation integration
**Coverage:** Execution pipeline, transaction safety, persistence verification, hook sequencing
**Status:** Architect-approved ✅

### ✅ ORM Package Testing Complete (74 tests)
**Files:** ChangeTracker.test.ts (45), DbSet.test.ts (29)
**Coverage:** Entity state management, CRUD operations, change tracking, batch operations
**Status:** Architect-approved ✅

### ✅ Query Package Testing Complete (85 tests)
**Files:** QueryBuilder.test.ts (35), QueryModel.test.ts (22), CountCache.test.ts (28)
**Coverage:** SQL generation, immutable query models, TTL/FIFO caching
**Status:** Architect-approved ✅

### ✅ Core Package Testing Complete (125 tests)  
**Major Fix:** Resolved circular dependency in relationship decorators (thunk-based lazy resolution)
**Status:** Architect-approved ✅

### ✅ Metadata Package Complete (52 tests)
**Status:** Architect-approved ✅

### ✅ Tier 0 Foundation Complete (327 tests)
**Status:** All passing ✅

**Tier 1 Total: 410 tests passing (Metadata 52 + Core 125 + Query 85 + ORM 74 + Migrations 74)**

### 🎉 TIER 2 PARTIAL COMPLETE - UTILITIES & CACHE ADAPTERS APPROVED ✅

### ✅ Utility Packages Complete (60 tests)
- cache (28 tests), pagination (7 tests), concurrency (25 tests)
**Status:** Architect-approved ✅

### ✅ Cache Adapters Complete (123 tests)
**Files:**
- cache-redis: RedisCountCacheAdapter (31), RedisSqlCacheAdapter (32) = 63 tests
- cache-memcached: MemcachedCountCacheAdapter (29), MemcachedSqlCacheAdapter (31) = 60 tests
**Major Production Fix:** Implemented proper async read-through with `getAsync()` methods
- Sync `get()`: Shadow cache only (L1 cache)
- Async `getAsync()`: Shadow + remote read-through (L1 + L2 cache)
- Correct metrics tracking: shadow hits/misses only, no double-counting
- Full metrics: totalRequests, hits, misses, evictions, invalidations
**Status:** Architect-approved ✅

### ✅ SQL Dialects Complete - 234 tests
**Files:**
- dialect-sqlite: SQLiteDialect.test.ts (24), SQLiteDdlStrategy.test.ts (37) = 61 tests
- dialect-postgres: PostgresDialect.test.ts (27), PostgresDdlStrategy.test.ts (31) = 58 tests
- dialect-mysql: MysqlDialect.test.ts (27), MySqlDdlStrategy.test.ts (31) = 58 tests
- dialect-mssql: MssqlDialect.test.ts (29), MssqlDdlStrategy.test.ts (28) = 57 tests
**Coverage:** 
- SQLite: SELECT, DDL, type mapping, INTEGER AUTOINCREMENT, LIMIT -1 quirk
- PostgreSQL: SELECT with $1..$n params, "quoted" identifiers, DDL with USING/NULLS/CONCURRENT, UUID/JSONB/TIMESTAMPTZ, CTE
- MySQL: SELECT with `backtick` identifiers, LIMIT 18446744073709551615 quirk, FULLTEXT/SPATIAL indexes, INVISIBLE/VISIBLE
- MSSQL: SELECT with [brackets], @p1..@pn params, TOP/OFFSET FETCH, PERSISTED computed columns, INCLUDE indexes
**Major Fixes:** PostgreSQL `quoteIdentifier()` proper escaping, MySQL backtick identifier support
**Status:** Architect-approved ✅

### ✅ Database Providers Complete - 84 tests (REFACTORED TO CONFIG OBJECTS)
**Files:**
- provider-sqlite: SQLiteProvider.test.ts (20 tests)
- provider-postgres: PostgresProvider.test.ts (21 tests)
- provider-mysql: MySqlProvider.test.ts (20 tests)
- provider-mssql: MssqlProvider.test.ts (22 tests)
**Coverage:** 
- Config object-based constructors (SQLiteConfig, PostgresConfig, MySqlConfig, MssqlConfig)
- Internal connection string assembly from config
- Dialect initialization
- Provider metadata (providerName, isConnected, inTransaction)
- Full edge case handling (IPv6, SSL modes, special characters, query parameters)
- CLI provider factory with complete connection string parsing
**Major Refactoring:** All providers now use config objects instead of connection strings
**Status:** All 84 tests passing ✅

**🎉 TIER 2 COMPLETE! Total: 501 tests** (Utilities 60 + Cache Adapters 123 + Dialects 234 + Providers 84)

**Overall Total: 1238 tests in Tier 0+1+2 combined** (327 + 410 + 501)

### 📊 Critical Features Migration Summary (November 19, 2025)

**Migrated Tests**: 45 tests across 8 files  
**Production Features**:
- Circuit Breaker resilience (core/tests-new)
- Prometheus observability (prometheus-sql-logger/tests-new, core/tests-new)
- Property-based testing (pagination/tests-new, query/tests-new)
- MemoryFallback infrastructure (query/tests-new)

**Pending Migration**:
- Graceful degradation test suite (9 files, ~40 tests) - requires ProviderStub migration

**Total Test Count**: ~1,280+ tests (1238 in Tier 0-2 + 45 migrated critical features)

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Architectural Pattern

The framework employs a layered architecture similar to Entity Framework:
-   **Entity Layer**: Uses TypeScript legacy experimental decorators for entity definition and metadata storage.
-   **Context Layer**: `DbContext` handles entity sets, change tracking, and transactional operations.
-   **Provider Layer**: An abstract `DatabaseProvider` enables pluggable database support for various SQL databases.
-   **Query Layer**: Offers LINQ-style query building via a `Queryable` interface.

## UI/UX Decisions

As a backend ORM, the framework has no direct UI. Design focuses on API ergonomics and developer experience, aiming for an Entity Framework Core-like feel and established ORM naming conventions.

## Technical Implementations

-   **TypeScript Legacy Experimental Decorators**: Uses `experimentalDecorators` with `reflect-metadata` for robust decorator support.
-   **Turborepo + pnpm**: Monorepo management for fast builds and efficient dependency management.
-   **Modular Package Structure**: Decomposed into 30+ packages for tree-shaking and faster builds.
-   **Type Safety**: Extensive TypeScript usage for compile-time validation, including `TypedQueryable`.
-   **Comprehensive Testing**: Comprehensive test suite using Jest with ts-jest transformer.
-   **Build System**: Dual-build strategy for CJS and ESM with declaration file synchronization for cross-platform compatibility.

## Feature Specifications

-   **Code-First Approach**: Define schema using TypeScript classes and decorators.
-   **LINQ-style Queries**: Fluent API for complex queries.
-   **Change Tracking**: Automatic detection of entity state changes.
-   **Multi-Database Support**: Abstraction for SQLite, PostgreSQL, MySQL, MSSQL.
-   **Migrations**: Tools for schema evolution.
-   **Caching**: Multiple levels of caching for performance (`SqlCache`, `CountCache`, `EntityCache`).
-   **Extensible**: Middleware pipeline for custom logic (`OrmMiddleware`).
-   **TypedQueryable**: Provides compile-time type safety for query operations.
-   **Error Handling**: Database-specific error mapping and retry policies.

## System Design Choices

-   **Metadata and Decorator System**: `MetadataStorage` singleton centralizes entity metadata; decorators use `reflect-metadata` for compile-time registration. Includes support for relationships, indexes, validation, and constraints.
-   **Change Tracking**: `ChangeTracker` monitors entity states; `DbSet` operations update states; `SaveChanges()` processes changes transactionally with optimistic concurrency control.
-   **Database Provider Abstraction**: Separates concerns for database interactions, managing connections, SQL dialects, and error mapping. Includes `SqlDialect` classes for SQL generation.
-   **Query Building and SQL Generation**: `Queryable` provides a LINQ-style API; `QueryBuilder` generates SQL using `SqlDialect`; `PredicateParser` converts expressions to SQL. Supports advanced query features.
-   **Migration System**: Code-first migration support with `Migration` base class, `MigrationRunner`, `DiffBasedMigration`, and `MigrationBuilder`.

# External Dependencies

-   **sqlite3**: SQLite database driver.
-   **pg**: PostgreSQL database driver.
-   **mysql2**: MySQL database driver.
-   **mssql**: Microsoft SQL Server database driver.
-   **TypeScript**: Primary development language.
-   **reflect-metadata**: Runtime reflection for legacy experimental decorators.
-   **Turborepo**: High-performance build system for monorepos.
-   **pnpm**: Fast, disk-space efficient package manager.
-   **Jest**: Testing framework.