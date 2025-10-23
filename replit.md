# Overview

This project is a TypeScript ORM framework, inspired by Entity Framework Core.

## Recent Changes - October 23, 2025

### ✅ Test Infrastructure: Jest with Legacy Decorators
**Status**: Successfully configured and stable

#### Decision
After discovering fundamental incompatibility between Vitest and legacy decorators (Vitest's runtime provides invalid `target` values to property decorators even with TypeScript compiler), reverted to Jest which has battle-tested support for legacy decorators.

#### Changes Made
- ✅ Reverted 150+ test files: vitest → jest (vi.fn → jest.fn, vi.spyOn → jest.spyOn)
- ✅ Created jest.config.js with proper legacy decorator support
- ✅ Installed Jest dependencies: jest, @jest/globals, ts-jest, @types/jest
- ✅ Installed reflect-metadata as runtime dependency
- ✅ Added all 35 packages to moduleNameMapper (migrations, concurrency, pagination, plugins, etc.)
- ✅ Added lib: ["ES2021", "DOM"] for FinalizationRegistry support
- ✅ Removed Vitest dependencies and vitest.config.ts
- ✅ Updated package.json test scripts
- ✅ **Legacy decorators work perfectly with Jest** - no target.name or MetadataStorage errors

### Test Status  
- **Jest running successfully** with legacy experimental decorators ✅
- **Core decorator tests: 3/3 passing** ✅
  - Entity registration with field metadata ✅
  - Works without creating instances ✅
  - Primary key registration ✅
- **CLI tests: 17/17 suites passing, 55/55 tests** ✅
  - All migration tests working ✅
  - FinalizationRegistry support working ✅
  - Command registry, generators, schema tools all passing ✅
- Remaining test failures: TypeScript compilation errors in some legacy test files (implicit any, missing properties)
- **Core decorator architecture stable and fully working** 🎯

---

It provides a code-first approach to database management, utilizing TypeScript legacy experimental decorators for entity definitions, LINQ-style query building, and supporting multiple database providers (SQLite, PostgreSQL, MySQL, MSSQL). The framework emphasizes type safety, change tracking, and adheres to SOLID principles for a clean, extensible architectural design, aiming to offer a robust and developer-friendly ORM solution for TypeScript applications.

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

The system uses TypeScript legacy experimental decorators with reflect-metadata:
-   A `MetadataStorage` singleton centralizes entity metadata.
-   Decorators use `reflect-metadata` for compile-time metadata registration.
-   Property decorators (@Column, @PrimaryKey) register metadata immediately during class definition.
-   Class decorators (@Entity, @Index) finalize entity registration.
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

-   **TypeScript Legacy Experimental Decorators**: Uses battle-tested `experimentalDecorators` with `reflect-metadata` for robust decorator support across all tooling.
-   **Turborepo + pnpm**: Monorepo management for fast builds and efficient dependency management.
-   **Modular Package Structure**: Decomposed into 30+ packages for tree-shaking and faster builds.
-   **Type Safety**: Extensive TypeScript usage for compile-time validation, including `TypedQueryable`.
-   **Comprehensive Testing**: Over 232 test files (unit and E2E) using Vitest with ~2.5-3x faster execution than Jest. Currently **34 test files passing (129 individual tests)** with remaining failures due to incomplete jest→vitest syntax migration in older test files.

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
-   **Vitest**: Testing framework for fast, parallel test execution.
-   **reflect-metadata**: Runtime reflection for legacy experimental decorators.
-   **ESLint**: Code linting.
-   **Prettier**: Code formatting.
-   **TypeDoc**: API documentation generation.
-   **ts-node**: TypeScript execution for scripts.
-   **husky**: Git hooks management.

## Build and Tooling Dependencies

-   **Turborepo**: High-performance build system for monorepos.
-   **pnpm**: Fast, disk-space efficient package manager.