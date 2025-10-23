# Overview

This project is a TypeScript ORM framework, inspired by Entity Framework Core.

## Recent Changes - October 23, 2025

### Vitest Migration (Partial)
- ✅ Migrated test infrastructure from Jest to Vitest  
- ✅ Configured unplugin-swc for native Stage-3 decorator compilation
- ✅ Performance gain: ~2.5x faster test execution (1.56s vs ~4s)
- ✅ Created test infrastructure with real decorators (@Entity, @Column, @PrimaryKey)

### Critical Discovery: SWC Stage-3 Decorator Limitations
- ⚠️ **CRITICAL:** SWC `decoratorVersion: '2022-03'` has severe field decorator limitations
- **Root Cause Identified:** SWC '2022-03' does NOT support:
  - `context.addInitializer()` for field decorators (only class decorators)
  - Returned initializer functions from field decorators are NOT executed
  - `Symbol.metadata` (newer TC39 feature)
- **Impact:** Field decorators (@Column, @PrimaryKey, @ManyToOne, etc.) cannot register metadata
- **Current State:** Only @Entity (class decorator) works correctly; all field metadata registration fails

### Attempted Solutions
1. ❌ PendingMetadataCollector with `addInitializer` - not supported for field decorators
2. ❌ Returned initializer functions - not executed by SWC
3. ❌ GlobalThis with WeakMap + returned initializers - initializers never run
4. ✅ @Entity `addInitializer` works (class decorators supported)

### Path Forward Options
1. **Upgrade SWC:** Use newer `decoratorVersion` (e.g., '2023-05') that supports full Stage-3 spec
2. **Alternative Compiler:** Switch to TypeScript's tsc or Babel for Vitest compilation
3. **Fallback Pattern:** Use legacy decorator pattern alongside Stage-3 (detect environment)
4. **Manual Registration:** Explicit metadata registration API (breaks decorator-only approach)

### Test Status
- Entity Registration: ✅ 3/3 passing (class decorator works)
- Field Metadata: ❌ 0/12 passing (field decorators don't register)
- Overall: ~50% tests failing due to SWC limitations
- See TEST_STATUS.md for detailed breakdown

---

It provides a code-first approach to database management, utilizing Stage-3 decorator-based entity definitions, LINQ-style query building, and supporting multiple database providers (SQLite, PostgreSQL, MySQL, MSSQL). The framework emphasizes type safety, change tracking, and adheres to SOLID principles for a clean, extensible architectural design, aiming to offer a robust and developer-friendly ORM solution for TypeScript applications.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Architectural Pattern

The framework employs a layered architecture similar to Entity Framework:
-   **Entity Layer**: Uses TypeScript Stage-3 decorators for entity definition and metadata storage.
-   **Context Layer**: `DbContext` handles entity sets, change tracking, and transactional operations.
-   **Provider Layer**: An abstract `DatabaseProvider` enables pluggable database support for various SQL databases.
-   **Query Layer**: Offers LINQ-style query building via a `Queryable` interface.

## Metadata and Decorator System

The system relies exclusively on TypeScript Stage-3 decorators:
-   A `MetadataStorage` singleton centralizes entity metadata.
-   Decorators use `context.addInitializer()` for runtime entity structure capture, supporting SQL generation and validation.
-   Supports defining relationships, indexes, validation rules, and constraints.

## Change Tracking Implementation

Inspired by Entity Framework's change tracking:
-   `ChangeTracker` monitors entity states (Added, Modified, Deleted, Unchanged).
-   `DbSet` operations update these tracking states.
-   `SaveChanges()` processes all tracked changes within a single transaction, including optimistic concurrency control.

## Database Provider Abstraction

Ensures separation of concerns for database interactions:
-   Each provider manages connections, SQL dialect differences, and error mapping.
-   `SqlDialect` classes handle database-specific SQL generation.
-   Supports connection pooling, retry policies, and transaction management.

## Query Building and SQL Generation

Features a two-layer query system:
-   `Queryable` provides a LINQ-style fluent API.
-   `QueryBuilder` generates SQL using a pluggable `SqlDialect`.
-   `PredicateParser` converts lambda expressions to SQL, with an in-memory filtering fallback.
-   Supports advanced query features like joins, subqueries, grouping, pagination, and UNIONs.

## Performance Features

Includes caching and optimization layers:
-   `SqlCache` for generated SQL.
-   `CountCache` for aggregate queries.
-   `EntityCache` (L2 cache) for frequently accessed entities.
-   Batched loading to mitigate N+1 query problems.

## Migration System

Provides code-first migration support:
-   `Migration` base class with `up` and `down` methods.
-   `MigrationRunner` for executing and versioning migrations.
-   `DiffBasedMigration` and `MigrationBuilder` facilitate schema changes and automatic migration generation.

## Middleware Pipeline

An extensible middleware system for cross-cutting concerns:
-   `OrmMiddleware` interface for hooks (`beforeExecute`, `afterExecute`, `entityMaterialized`).
-   Enables SQL logging, metrics, and custom business logic.

## Error Handling

Database-specific error mapping:
-   Maps provider errors to standardized types (e.g., `UniqueConstraintError`).
-   Includes retry policies for transient failures.

## UI/UX Decisions

-   As a backend ORM, the framework has no direct UI. Design focuses on API ergonomics and developer experience, aiming for an Entity Framework Core-like feel and established ORM naming conventions.

## Technical Implementations

-   **TypeScript Stage-3 Decorators**: Utilizes latest TypeScript decorators, eliminating `reflect-metadata`.
-   **Turborepo + pnpm**: Monorepo management for fast builds and efficient dependency management.
-   **Modular Package Structure**: Decomposed into 30+ packages for tree-shaking and faster builds.
-   **Type Safety**: Extensive TypeScript usage for compile-time validation, including `TypedQueryable`.
-   **Comprehensive Testing**: Over 232 test files (unit and E2E) using Docker Compose for multi-database testing. **Currently migrating from Jest to Vitest** with SWC for native Stage-3 decorator support and ~2.5x faster execution. Migration revealed critical decorator metadata registration bugs that require refactoring before full test coverage can be achieved.

## Feature Specifications

-   **Code-First Approach**: Define schema using TypeScript classes and decorators.
-   **LINQ-style Queries**: Fluent API for complex queries.
-   **Change Tracking**: Automatic detection of entity state changes.
-   **Multi-Database Support**: Abstraction for SQLite, PostgreSQL, MySQL, MSSQL.
-   **Migrations**: Tools for schema evolution.
-   **Caching**: Multiple levels of caching for performance.
-   **Extensible**: Middleware pipeline for custom logic.
-   **TypedQueryable**: Provides compile-time type safety for query operations.

# External Dependencies

## Core Runtime Dependencies

-   **sqlite3**: SQLite database driver.
-   **pg**: PostgreSQL database driver.
-   **mysql2**: MySQL database driver.
-   **mssql**: Microsoft SQL Server database driver.

## Development and Testing Dependencies

-   **TypeScript**: Primary development language.
-   **Vitest**: Testing framework.
-   **unplugin-swc**: SWC integration for Vitest, enabling native Stage-3 decorator compilation.
-   **ESLint**: Code linting.
-   **Prettier**: Code formatting.
-   **TypeDoc**: API documentation generation.
-   **ts-node**: TypeScript execution for scripts.
-   **husky**: Git hooks management.

## Build and Tooling Dependencies

-   **Turborepo**: High-performance build system for monorepos.
-   **pnpm**: Fast, disk-space efficient package manager.