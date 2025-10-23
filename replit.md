# Overview

This project is a TypeScript ORM framework, inspired by Entity Framework Core. It offers a code-first approach to database management using Stage-3 decorator-based entity definitions, LINQ-style query building, and supports various database providers (SQLite, PostgreSQL, MySQL, MSSQL). The framework prioritizes type safety, change tracking, and adheres to SOLID principles for a clean architectural design.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Architectural Pattern

The framework adopts a layered architecture akin to Entity Framework:

-   **Entity Layer**: Uses TypeScript Stage-3 decorators for defining entities and storing metadata without `reflect-metadata`.
-   **Context Layer**: `DbContext` manages entity sets, change tracking, and transactional database operations.
-   **Provider Layer**: An abstract `DatabaseProvider` class allows for pluggable database support, with concrete implementations for various SQL databases.
-   **Query Layer**: Provides LINQ-style query building capabilities through a `Queryable` interface with method chaining.

## Metadata and Decorator System

The system exclusively uses TypeScript Stage-3 decorators:

-   A `MetadataStorage` singleton centralizes all entity metadata management.
-   Decorators utilize `context.addInitializer()` for runtime entity structure capture, aiding in SQL generation and validation.
-   Supports defining relationships, indexes, validation rules, and constraints via metadata.

## Change Tracking Implementation

Inspired by Entity Framework's change tracking mechanism:

-   `ChangeTracker` monitors entity states (Added, Modified, Deleted, Unchanged).
-   `DbSet` operations (`Add`, `Update`, `Remove`) update these tracking states.
-   `SaveChanges()` processes all tracked changes within a single transaction, including optimistic concurrency control.

## Database Provider Abstraction

Ensures clear separation of concerns:

-   Each provider manages connection, handles SQL dialect differences, and maps errors.
-   `SqlDialect` classes are responsible for database-specific SQL generation.
-   Supports connection pooling, retry policies, and transaction management.

## Query Building and SQL Generation

Features a two-layer query system:

-   `Queryable` offers a LINQ-style fluent API.
-   `QueryBuilder` generates SQL using a pluggable `SqlDialect`.
-   `PredicateParser` converts lambda expressions into SQL, with a fallback to in-memory filtering.
-   Supports advanced query features like joins, subqueries, grouping, pagination, and UNIONs.

## Performance Features

Includes multiple caching and optimization layers:

-   `SqlCache` for caching generated SQL.
-   `CountCache` with TTL for expensive aggregate queries.
-   `EntityCache` (L2 cache) for frequently accessed entities.
-   Batched loading to mitigate N+1 query problems for relationships.

## Migration System

Provides code-first migration support:

-   `Migration` base class with `up` and `down` methods.
-   `MigrationRunner` for executing and versioning migrations.
-   `DiffBasedMigration` compares schema states, and `MigrationBuilder` offers a fluent API for schema changes.
-   Supports automatic migration generation based on schema diffing.

## Middleware Pipeline

An extensible middleware system for cross-cutting concerns:

-   `OrmMiddleware` interface for hooks like `beforeExecute`, `afterExecute`, and `entityMaterialized`.
-   Enables SQL logging, metrics collection, and custom business logic.
-   Composable, supporting error handling and asynchronous operations.

## Error Handling

Database-specific error mapping:

-   Maps provider-specific errors to standardized types (e.g., `UniqueConstraintError`).
-   Includes retry policies with exponential backoff for transient failures.
-   Provides graceful degradation for unsupported query operations.

## UI/UX Decisions

-   The framework itself is a backend ORM and does not have a direct UI. Design decisions are focused on API ergonomics and developer experience, aiming for an Entity Framework Core-like feel.
-   Naming conventions follow established ORM patterns for familiarity.

## Technical Implementations

-   **TypeScript Stage-3 Decorators**: All decorators conform to the latest TypeScript standard, eliminating `reflect-metadata` and `experimentalDecorators`.
-   **Turborepo + pnpm**: For monorepo management, enabling fast, incremental builds and efficient dependency management.
-   **Modular Package Structure**: Decomposed into 30+ modular packages (`@ts-linq/*` scope) for improved tree-shaking, smaller bundles, and faster builds.
-   **Type Safety**: Extensive use of TypeScript for compile-time validation, including a `TypedQueryable` for query operations.
-   **Comprehensive Testing**: Over 232 test files covering unit and E2E scenarios, utilizing Docker Compose for multi-database testing.

## Feature Specifications

-   **Code-First Approach**: Define database schema using TypeScript classes and decorators.
-   **LINQ-style Queries**: Fluent API for building complex queries.
-   **Change Tracking**: Automatic detection of entity state changes for efficient updates.
-   **Multi-Database Support**: Abstraction layer for seamless switching between SQLite, PostgreSQL, MySQL, and MSSQL.
-   **Migrations**: Tools for managing schema evolution.
-   **Caching**: Multiple levels of caching for performance optimization.
-   **Extensible**: Middleware pipeline for custom logic and integrations.

# External Dependencies

## Core Runtime Dependencies

-   **sqlite3**: SQLite database driver.
-   **pg**: PostgreSQL database driver.
-   **mysql2**: MySQL database driver.
-   **mssql**: Microsoft SQL Server database driver.

## Development and Testing Dependencies

-   **TypeScript**: Primary development language.
-   **Jest**: Testing framework.
-   **ts-jest**: TypeScript preprocessor for Jest.
-   **ESLint**: Code linting.
-   **Prettier**: Code formatting.
-   **TypeDoc**: API documentation generation.
-   **ts-node**: TypeScript execution for scripts.
-   **husky**: Git hooks management.

## Build and Tooling Dependencies

-   **Turborepo**: High-performance build system for monorepos.
-   **pnpm**: Fast, disk-space efficient package manager.

# Recent Changes

## Type Safety Integration (October 23, 2025)

### TypedQueryable Restoration & DbSet Integration

**Problem Discovered**: TypedQueryable was accidentally removed during architecture refactoring, eliminating critical compile-time type safety for query operations.

**Solution Implemented**:

1. **TypedQueryable Restored** (`packages/query/src/TypedQueryable.ts`):
   - 365 lines of compile-time type safety wrapper around Queryable
   - Validates `.select()` - prevents accessing non-existent properties
   - Validates `.include()` - only allows relationship properties via `RelationshipProperties<T>` type
   - Provides Entity Framework-style API (`.except()`, `.intersect()`, `.concat()`)
   - Zero runtime overhead - all checks happen at compile-time

2. **DbSet Integration Complete** (`packages/orm/src/DbSet.ts`):
   - **All query methods now return `TypedQueryable<T>`** instead of `Queryable<T>`
   - Updated methods: `where()`, `select()`, `orderBy()`, `orderByDescending()`, `take()`, `skip()`, `distinct()`, `include()`, `union()`, `unionAll()`
   - **Transparent to users** - users write pure Entity Framework-style code without seeing TypedQueryable

**User Experience** (Entity Framework Core-compatible):

```typescript
// ✅ Users write clean EF-style queries - TypedQueryable is automatic!
const users = await ctx.users
  .where(u => u.age >= 18)
  .select(u => ({ id: u.id, name: u.name }))
  .include(u => u.orders)
  .toArray();

// ❌ COMPILE ERROR - TypeScript catches errors immediately
const invalid = await ctx.users
  .select(u => ({ bad: u.nonExistent }));  // ❌ Property 'nonExistent' does not exist

const badInclude = await ctx.users
  .include(u => u.name);  // ❌ 'name' is not a relationship property
```

**Technical Details**:
- DbSet methods wrap Queryable with `TypedQueryable.from()` before returning
- `RelationshipProperties<T>` type helper extracts only array/object properties (excluding Date/Function)
- Full build success: 34/34 packages compile without errors
- Documentation created: `docs/guides/typed-queryable.md`