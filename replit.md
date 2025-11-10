# Overview

This project is a TypeScript ORM framework, inspired by Entity Framework Core.

## Recent Changes - November 10, 2025

### ✅ Core Package Testing Complete + Major Production Fix
**Status**: 126 tests passing, critical decorator bug fixed, architect-reviewed and approved

#### Major Production Fix
**Circular Dependency Bug in Relationship Decorators** - Fixed system-wide issue affecting all relationship metadata:

**Problem:** Decorators eagerly resolved `targetEntity` thunks during class decoration, causing TDZ errors with forward references:
```typescript
@OneToMany(() => Post, ...)  // ERROR: Post not defined yet during User decoration
posts?: Post[];
```

**Root Cause:** `defineRelationship()` in Relationships.ts and MetadataStorage.addRelationshipMetadata() immediately invoked thunks instead of storing them for lazy evaluation.

**Solution:** Modified to store thunks and defer resolution until metadata consumption:
- `packages/core/src/decorators/Relationships.ts` - Store thunk as-is
- `packages/metadata/src/MetadataStorage.ts` - Preserve lazy evaluation throughout stack
- Consumers (EntityLoader, LazyLoadingProxy) already support thunk resolution

**Impact:**
- ✅ Enables proper forward references (Entity Framework Core pattern)
- ✅ Fixes TDZ errors in modern ES compilation
- ✅ No regression in existing tests
- ✅ System-wide improvement for all relationship decorators

#### Test Coverage
**Test Files Created (126 tests):**
- `DdlBuilder.test.ts` (8 tests) - DDL SQL generation with strategy pattern
- `SqlHelper.test.ts` (27 tests) - SQL helpers (escapeIdentifier, formatValue, WHERE/ORDER BY/LIMIT clauses)
- `BatchExecutor.test.ts` (7 tests) - Transaction-aware batch execution
- `EntityCache.test.ts` (24 tests) - L2 FIFO entity cache with eviction
- `RetryPolicies.test.ts` (16 tests) - ExponentialBackoff, FixedInterval, NoRetry policies
- `InternalLogger.test.ts` (10 tests) - Safe internal error logging
- `LoadingStrategy.test.ts` (8 tests) - Enum values and strategy usage
- `EntityLoader.test.ts` (26 tests) - Entity loading with decorator-registered metadata, lazy/eager strategies, batching

**EntityLoader Tests Now Include:**
- Decorator-registered metadata with real User ↔ Post relationships
- Provider batching verification (findWhereIn calls)
- Depth handling and includes options
- Error propagation

**Testing Patterns:**
- Comprehensive edge case coverage
- Proper Jest setup/teardown with mocks
- Deterministic tests (no flaky timing/random assertions)
- Focus on public API behavior

**Coverage:** 126 tests passing (Tier 0: 327 + metadata: 52 + core: 126 = **505 total tests**)

**Architect Approval:** "PASS - decorator changes defer resolution correctly, no regression, approve Tier 1 core work"

---

### ✅ Legacy Decorators Migration & Metadata Package Testing Complete
**Status**: 52 metadata tests passing (25 MetadataStorage + 27 Decorators), all decorators converted to legacy syntax

#### Accomplishment
Successfully migrated entire metadata package from Stage-3 decorators to legacy decorators (`experimentalDecorators: true`) and created comprehensive test coverage for all decorator functionality.

**Decorators Converted (8 files):**
- `Entity.ts` - Class decorator for entity registration
- `Column.ts` - Property decorator with auto-entity creation
- `PrimaryKey.ts` - Property decorator with branded PK support
- `Relationships.ts` - OneToMany, ManyToOne, OneToOne, ManyToMany
- `ComputedColumn.ts` - Computed column decorator
- `DatabaseFunction.ts` - Database function decorator  
- `ValidIf.ts` - 6 validation decorators (ValidIf, RequiredIfOf, MinLengthOf, MaxLengthOf, PatternOf, RangeOf)
- `CachePolicy.ts` - Cache policy decorator

**Critical Fixes:**
1. **Execution Order Handling**: Property decorators auto-create entity metadata when @Entity hasn't run yet
2. **MetadataStorage.registerEntity**: Fixed to update finalized entities instead of recreating builders
3. **Jest Configuration**: Updated to ts-jest@29 modern API with `experimentalDecorators` enabled

**Test Coverage:**
- MetadataStorage API: 25 tests (registration, retrieval, validation, finalization)
- Decorator functionality: 27 tests (all decorators + execution order scenarios)

#### Testing Framework
- Jest (not Vitest) with ts-jest transformer configured for legacy decorators
- All decorators tested via direct function calls (not inline annotations due to Jest limitations)
- Proper cleanup with `afterEach(() => MetadataStorage.getInstance().clear())`

---

### ✅ Test Suite Rewrite: Tier 0 Foundation Packages Complete
**Status**: 327 tests passing, architect-reviewed and approved

#### Accomplishment
Completed comprehensive test coverage for all 6 Tier 0 foundation packages:

| Package | Tests | Coverage |
|---------|-------|----------|
| types | 50 | Result helpers, error classes, enums, type exports |
| config | 76 | ConfigBuilder fluent API, ConfigLoader with file loading |
| ast | 60 | AST nodes, Specification pattern, Binary/Logical/SqlVisitor |
| sql-visitor | 2 | Placeholder package with minimal coverage |
| metrics-safe | 35 | Safe metric logging, MemoryProfiler |
| testkits | 104 | EntityBuilder, MockProvider, DatabaseHarness, SqlSnapshotMatcher, Fixtures |
| **Total** | **327** | **All foundation utilities** |

#### Key Improvements
- **Global State Management**: Fixed ConfigLoader to properly restore `process.cwd()` in `afterAll`, preventing test pollution
- **Comprehensive Testkits**: Added missing coverage for DatabaseHarness, SqlSnapshotMatcher, and TestEntities fixtures
- **Test Quality**: All tests use proper setup/teardown, handle edge cases, and follow Jest best practices
- **Cross-Package Compatibility**: All 18 test suites run successfully together without conflicts

#### Testing Framework
- Using Jest (not Vitest) with ts-jest transformer
- All tests include proper `afterEach` cleanup for state isolation
- Test execution verified: `pnpm test -- packages/{types,config,ast,sql-visitor,metrics-safe,testkits}/tests`

#### Next Steps
- Ready to proceed to Tier 1 packages: metadata, core, query, orm, migrations
- Monitor ts-jest deprecation warnings for future config updates

---

## Previous Changes - October 29, 2025

### ✅ Build System: Cross-Platform Declaration File Management
**Status**: Successfully configured and stable

#### Problem
The dual-build system (CJS in dist/, ESM in dist/esm/) had two critical issues:
1. Windows incompatibility: Shell commands (`find`, `while read`) in copy:types scripts failed on Windows
2. Declaration file conflicts: Both CJS and ESM builds generated .d.ts files, creating potential mismatches

#### Solution
**Dual-Build Strategy with Declaration Synchronization:**
1. **CJS Build** (`tsconfig.json`): Compiles to `dist/` with declarations (required by TypeScript composite mode)
2. **ESM Build** (`tsconfig.esm.json`): Compiles to `dist/esm/` with declarations
3. **Declaration Sync** (`scripts/copy-types.js`): Cross-platform Node.js script that:
   - Cleans stale .d.ts files from `dist/` (excluding `dist/esm/`)
   - Copies fresh declarations from `dist/esm/` to `dist/`
   - Guarantees .d.ts parity between CJS and ESM builds
   - Works on Windows, macOS, and Linux without shell dependencies

**Why this approach:**
- TypeScript composite projects require `declaration: true` (cannot be disabled)
- Dual builds (CJS + ESM) each generate their own .d.ts files
- Copying from single source (ESM) ensures type consistency across module formats
- Standard solution for dual-format TypeScript libraries

#### Changes Made
- ✅ Created `scripts/copy-types.js` with cleanDtsFiles() and copyTypesRecursive()
- ✅ Updated 7 packages to use `node ../../scripts/copy-types.js` instead of shell commands
  - core, query, migrations, provider-sqlite, provider-postgres, provider-mysql, provider-mssql
- ✅ Created `packages/types/tsconfig.build.json` for separate build configuration
- ✅ Fixed TypeScript composite mode references in prometheus-sql-logger and open-telemetry-sql-logger

### Build Status
- **All 35 packages compile successfully** ✅
- **Turbo cache fully operational** (FULL TURBO) ✅
- **Cross-platform build verified** (Windows/Linux/macOS) ✅
- **Declaration file parity guaranteed** between CJS and ESM ✅
- **Zero TypeScript compilation errors** ✅

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
-   **Comprehensive Testing**: Comprehensive test suite using Jest with ts-jest transformer. Test suite is being rewritten from scratch with improved coverage and organization.

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