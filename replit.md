# Overview

This project is a TypeScript ORM framework, inspired by Entity Framework Core, providing a code-first approach to database management. It utilizes TypeScript legacy experimental decorators for entity definitions, offers LINQ-style query building, and supports multiple database providers (SQLite, PostgreSQL, MySQL, MSSQL). The framework emphasizes type safety, change tracking, and adheres to SOLID principles, aiming to be a robust and developer-friendly ORM solution for TypeScript applications.

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

# Recent Changes

## November 19, 2025: Plugin Packages Implementation

**Plugin Packages Created**: Extracted soft-delete, audit, and multi-tenant functionality into standalone packages:

**Implementation Details**:
- **@ts-linq/plugin-soft-delete** (31 tests): SoftDeleteMiddleware handles boolean and timestamp-based soft deletes with query filtering
- **@ts-linq/plugin-audit** (56 tests): AuditMiddleware auto-fills createdAt/updatedAt/createdBy/updatedBy with support for async getCurrentUser
- **@ts-linq/plugin-multi-tenant** (45 tests): MultiTenantMiddleware provides tenant isolation with automatic query filtering

**Test Results**: 132 tests passing across 3 plugin packages (exceeded planned 75 tests)
- All plugins use Jest with ts-jest
- Middleware pattern validated by architect
- Type-safe implementations with full TypeScript support

**Next Steps**:
- Define DbContext middleware hook interface
- Integrate plugins with DbContext.saveChanges() pipeline
- Add contract tests for hook interfaces
- Configure dual build (CJS/ESM) for all plugins

**Current Test Coverage**: 1,286 (Tiers 0-2) + 132 (plugins) = **1,418 tests**

## November 19, 2025: Tier 3 Testing Assessment

**Tier 3 Plugin Testing Status**: After architect review, plugin tests (soft-delete, audit) identified as blocked pending middleware implementation:
- **Finding**: Soft-delete and audit functionality exists in DbContext options but lacks middleware hooks for SaveChanges() interception
- **Blockers**: 
  - Mock DatabaseProvider approach failed due to constructor/interface obligations
  - Full DbContext integration tests require unimplemented middleware pipeline
  - Plugin packages (plugin-soft-delete, plugin-audit, plugin-multi-tenant) have empty src/ directories
- **CLI Package**: ✅ **Passes** - 16 test files with 27 test suites already exist and run successfully
- **Recommendation**: Defer plugin integration tests to post-middleware implementation; focus on unit tests for middleware functions when ready
- **Current Test Coverage**: 1,286 tests passing (Tiers 0-2 complete)

**Test Plan Updates**:
- Tier 3 originally planned: 175 tests (plugins + CLI + integrations)
- Tier 3 achievable now: ~27 test suites (CLI only) - plugins blocked
- Integration tests and E2E tests remain planned but require infrastructure completion

## November 19, 2025: E2E Tests Plan Detailed

**Comprehensive E2E Test Plan** (10 days, ~323 tests)  
Expanded E2E testing plan in `test-plan.md` with full Arrange-Act-Assert specifications:
- **Location**: `packages/e2e-tests`
- **Infrastructure**: Docker-compose with PostgreSQL, MySQL, MSSQL, Redis, Memcached
- **Testing Approach**: Full workflow validation from entity definition → query → persistence

**Test Suites Breakdown**:

1. **Day 1: Infrastructure** (8 tests): Database connections, pooling, Redis/Memcached setup
2. **Day 2-3: CRUD & Change Tracking** (60 tests):
   - SQLite CRUD: 13 tests (auto-increment, constraints, defaults)
   - PostgreSQL CRUD: 13 tests (similar coverage)
   - MySQL CRUD: 13 tests (similar coverage)
   - MSSQL CRUD: 13 tests (similar coverage)
   - Change Tracking: 20 tests (entity states, modified properties, batch saves, concurrency control, attach/detach)

3. **Day 4: Relationships** (35 tests):
   - One-to-Many: 10 tests (eager/lazy loading, N+1 prevention, cascading)
   - Many-to-One: 10 tests
   - Many-to-Many: 10 tests (junction tables, bidirectional navigation)
   - Lazy Loading: 8 tests
   - Eager Loading: 7 tests

4. **Day 5: LINQ Queries** (40 tests):
   - Complex WHERE: 10 tests (AND/OR, LIKE, IN, NULL handling, expressions)
   - JOINs: 7 tests (INNER, LEFT, RIGHT, multi-table, self-join)
   - Aggregations: 10 tests (SUM, AVG, MIN, MAX, GROUP BY, HAVING, window functions)
   - Subqueries: 8 tests (IN, EXISTS, scalar, correlated, nested)

5. **Day 6: Transactions** (30 tests):
   - Commit/Rollback: 10 tests (explicit/auto commit, error rollback, sequential TXs)
   - Savepoints: 7 tests (nested transactions, rollback to savepoint)
   - Isolation Levels: 10 tests (READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE, SNAPSHOT)
   - Deadlocks: 8 tests (detection, retry policies, circular deadlocks)

6. **Day 7: Migrations** (35 tests) - Schema creation, up/down, rollback, diff-based migrations
7. **Day 8: Caching** (40 tests) - SQL cache, entity cache, Redis/Memcached integration, invalidation
8. **Day 9: Performance & Concurrency** (45 tests) - Bulk operations, N+1 prevention, indexing, optimistic/pessimistic locking
9. **Day 10: Multi-Provider** (30 tests) - Cross-provider consistency, type mapping, provider switching

**Test Plan Updates**:
- **Integration Tests**: 7 days, ~240 tests (added earlier today)
- **E2E Tests**: 10 days, ~323 tests (expanded from 9 days)
- **Total Effort**: 51 days for comprehensive testing
- **Total Packages**: 36 packages