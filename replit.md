# Overview

This is a TypeScript ORM (Object-Relational Mapping) framework heavily inspired by Entity Framework Core. It provides a code-first approach to database management with decorator-based entity definitions, LINQ-style query building, and support for multiple database providers (SQLite, PostgreSQL, MySQL, MSSQL). The framework emphasizes type safety, change tracking, and a clean architectural design following SOLID principles.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Architecture Pattern

The framework follows Entity Framework's layered architectural patterns:

- **Entity Layer**: Uses TypeScript decorators (`@Entity`, `@Column`, `@PrimaryKey`, `@OneToMany`, `@ManyToOne`) with reflect-metadata for entity configuration and metadata storage
- **Context Layer**: `DbContext` manages entity sets, change tracking, and database operations with transactional support
- **Provider Layer**: Abstract `DatabaseProvider` base class enables pluggable database support with concrete implementations for SQLite, PostgreSQL, MySQL, and MSSQL
- **Query Layer**: LINQ-style query building through `Queryable` with method chaining (where, select, orderBy, include, joins)

## Metadata and Decorator System

Uses TypeScript's experimental decorator support with reflect-metadata:

- `MetadataStorage` singleton centralizes all entity metadata management
- Decorators capture entity structure at runtime for SQL generation and validation
- Supports relationships, indexes, and constraints through metadata

## Change Tracking Implementation

Implements Entity Framework's change tracking pattern:

- `ChangeTracker` monitors entity states (Added, Modified, Deleted, Unchanged)
- `DbSet` provides Add/Update/Remove operations that update tracking state
- `SaveChanges()` processes all tracked changes in a single transaction with optimistic concurrency

## Database Provider Abstraction

Clean separation of concerns through provider abstraction:

- Each provider handles connection management, SQL dialect differences, and error mapping
- `SqlDialect` classes handle database-specific SQL generation (parameter placeholders, escaping, DDL)
- Supports connection pooling, retry policies, and transaction management

## Query Building and SQL Generation

Two-layer query system:

- `Queryable` provides LINQ-style method chaining interface
- `QueryBuilder` with pluggable `SqlDialect` handles SQL generation
- `PredicateParser` converts simple lambda expressions to SQL with fallback to in-memory filtering
- Supports joins, subqueries, groupBy/having, pagination, and UNION operations

## Performance Features

Multiple caching and optimization layers:

- SQL generation cache (`SqlCache`) to avoid rebuilding identical queries
- Count query cache (`CountCache`) with TTL for expensive aggregate operations
- L2 entity cache (`EntityCache`) for frequently accessed entities
- Batched loading for relationships to avoid N+1 queries

## Migration System

Code-first migration support:

- `Migration` base class with up/down methods
- `MigrationRunner` handles migration execution and versioning
- `DiffBasedMigration` compares current schema with desired state
- `MigrationBuilder` provides fluent API for schema changes
- Supports schema diffing and automatic migration generation

## Middleware Pipeline

Extensible middleware system for cross-cutting concerns:

- `OrmMiddleware` interface for beforeExecute/afterExecute/entityMaterialized hooks
- Support for SQL logging, metrics collection, and custom business logic
- Composable middleware with error handling and async support

## Error Handling

Database-specific error mapping:

- Maps provider-specific errors to common error types (`UniqueConstraintError`, `ForeignKeyConstraintError`)
- Retry policies with exponential backoff for transient failures
- Graceful degradation for unsupported query operations

# External Dependencies

## Core Runtime Dependencies

- **reflect-metadata**: Required for TypeScript decorator metadata reflection
- **sqlite3**: SQLite database driver for local/embedded scenarios
- **pg**: PostgreSQL driver for production database scenarios
- **mysql2**: MySQL driver with promise support
- **mssql**: Microsoft SQL Server driver

## Development and Testing

- **TypeScript**: Core language with strict type checking enabled
- **Jest**: Testing framework with coverage reporting
- **ts-jest**: TypeScript integration for Jest
- **ESLint**: Code linting with TypeScript rules
- **Prettier**: Code formatting
- **TypeDoc**: API documentation generation

## Build and Tooling

- **ts-node**: TypeScript execution for development scripts
- **husky**: Git hooks for pre-commit validation
- Dual module output (CommonJS and ESM) for broad compatibility
- Comprehensive benchmark suite for performance monitoring
