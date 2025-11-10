# Overview

This project is a TypeScript ORM framework, inspired by Entity Framework Core, providing a code-first approach to database management. It utilizes TypeScript legacy experimental decorators for entity definitions, offers LINQ-style query building, and supports multiple database providers (SQLite, PostgreSQL, MySQL, MSSQL). The framework emphasizes type safety, change tracking, and adheres to SOLID principles, aiming to be a robust and developer-friendly ORM solution for TypeScript applications.

## Recent Testing Progress - November 10, 2025

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

**Total Progress: 589 tests passing**

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