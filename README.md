# ORM Framework

## Overview

This is a TypeScript ORM (Object-Relational Mapping) framework heavily inspired by Entity Framework Core. It provides a code-first approach to database management with decorator-based entity definitions, change tracking, LINQ-style querying, and a migration system. The framework follows Entity Framework's architectural patterns with a layered design that separates concerns between entity definitions, database operations, and query building.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture Pattern
The framework follows Entity Framework's architectural patterns with a layered approach:

- **Entity Layer**: Decorator-based entity definitions with metadata reflection
- **Context Layer**: DbContext manages entity sets, change tracking, and database operations  
- **Provider Layer**: Pluggable database provider architecture (currently supports SQLite)
- **Query Layer**: LINQ-style query building with method chaining

### Decorator-Based Metadata System
Uses TypeScript decorators and reflect-metadata for entity configuration:

- `@Entity()` marks classes as database entities
- `@Column()` defines column properties and constraints
- `@PrimaryKey()` designates primary key fields
- `@OneToMany()` and `@ManyToOne()` define relationships
- MetadataStorage centrally manages all entity metadata

### Change Tracking Implementation
Implements Entity Framework's change tracking pattern:

- ChangeTracker monitors entity states (Added, Modified, Deleted, Unchanged)
- DbSet provides Add/Update/Remove operations that update tracking state
- SaveChanges() processes all tracked changes in a single transaction

### Database Provider Abstraction
Abstract DatabaseProvider base class enables multiple database support:

- Currently implements SQLiteProvider using sqlite3 package
- Provider handles connection management, SQL generation, and query execution
- Clean separation allows adding MySQL, PostgreSQL providers later

### Query Builder System
LINQ-style query building with method chaining:

- Where() conditions with lambda expression parsing
- Select() projections for field selection
- OrderBy() sorting with multiple fields
- Limit/offset for pagination support

### Migration Framework
Code-first database evolution support:

- Abstract Migration base class for schema changes
- MigrationRunner manages migration execution order
- Up/Down methods for forward and rollback operations

## External Dependencies

### Core Dependencies
- **sqlite3**: Primary database engine for SQLite provider
- **reflect-metadata**: Enables TypeScript decorator metadata reflection
- **typescript**: TypeScript compiler and type definitions

### Development Dependencies
- **jest**: Testing framework with comprehensive test coverage
- **ts-jest**: TypeScript preprocessor for Jest
- **ts-node**: TypeScript execution environment for Node.js
- **@types/node**: Node.js type definitions
- **@types/sqlite3**: SQLite3 type definitions
- **@types/jest**: Jest type definitions

### Runtime Requirements
- Node.js with ES2020 support
- TypeScript experimental decorators enabled
- Reflect metadata polyfill loaded before entity definitions