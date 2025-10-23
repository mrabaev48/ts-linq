# Overview

This project is a TypeScript ORM framework, inspired by Entity Framework Core.

## Recent Changes - October 23, 2025

### 🔍 Critical Discovery: Vitest Decorator Execution Context Issue
**Status**: Investigating fundamental incompatibility between Vitest's execution model and legacy decorators

#### What We Discovered
1. **esbuild Issue**: esbuild (Vitest's default transformer) cannot emit legacy decorators - it only supports Stage 3
2. **TypeScript Compiler Issue**: Even with `esbuild: false`, Vitest's test execution context provides invalid `target` values to property decorators
3. **Root Cause**: Property decorators receive `undefined` or non-function `target` values, causing:
   - `target.name` → undefined
   - `target.constructor` → undefined  
   - MetadataStorage cannot register decorator metadata

#### Attempted Fixes
- ✅ Migrated 150+ test files: jest → vitest (jest.fn → vi.fn, jest.spyOn → vi.spyOn)
- ✅ Added reflect-metadata imports to 50+ test files
- ✅ Fixed decorator signatures: `target: Object` → `target: any`
- ✅ Added null-safety: `const ctor = (target?.constructor || target) as Function`
- ✅ Disabled esbuild in vitest.config.ts to use TypeScript compiler
- ❌ **Still failing**: target parameter still invalid in Vitest runtime

#### Architect Review Findings
- Vitest/esbuild mixes Stage-3 and legacy decorator semantics
- Property decorators receive context descriptors instead of prototypes
- Try-catch guards mask symptoms without fixing root cause
- Need to either: (1) Full Stage-3 migration with PendingMetadataCollector, or (2) Different test runner

### Test Status  
- **36 tests passing** (down from 129 after fixing decorator issues)
- Most failures: MetadataStorage.getInstance() undefined, target.name undefined
- Core decorator architecture needs rethinking for Vitest compatibility

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