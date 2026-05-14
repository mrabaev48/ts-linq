# ISSUE-007: Database-Specific Provider Configs in `@ts-linq/types`

## Severity

High

## Category

- Clean Architecture
- Dependency Boundary
- Public API

## Location

- `packages/types/src/index.ts` — exports `PostgresConfig`, `MySqlConfig`, `MssqlConfig`, `BaseProviderConfig`

## Problem

`@ts-linq/types` is the foundation package with **zero runtime dependencies** and is intended to hold pure, provider-agnostic type definitions. However, it exports three database-specific configuration interfaces:

- `PostgresConfig` — PostgreSQL connection options
- `MySqlConfig` — MySQL connection options  
- `MssqlConfig` — Microsoft SQL Server connection options
- `BaseProviderConfig` — shared base for the above

These types embed infrastructure-specific details (connection pooling, SSL, authentication modes, database-specific options) inside a package that should be unaware of any specific database technology.

## Evidence

```typescript
// packages/types/src/index.ts — both are exported:
export type { PostgresConfig } from '...';    // PostgreSQL-specific
export type { MySqlConfig } from '...';       // MySQL-specific
export type { MssqlConfig } from '...';       // MSSQL-specific
export type { BaseProviderConfig } from '...';
```

A consumer importing `@ts-linq/types` for generic ORM types (entity metadata, query options, SQL parameters) is implicitly told that PostgreSQL, MySQL, and MSSQL are all part of the core type contract. This makes `@ts-linq/types` aware of every database provider it must never know about.

The correct location for these types is in the respective provider or dialect packages:
- `PostgresConfig` → `@ts-linq/provider-postgres` or `@ts-linq/dialect-postgres`
- `MySqlConfig` → `@ts-linq/provider-mysql` or `@ts-linq/dialect-mysql`
- `MssqlConfig` → `@ts-linq/provider-mssql` or `@ts-linq/dialect-mssql`

## Why It Matters

- **Dependency boundary**: Every consumer of `@ts-linq/types` is implicitly coupled to three database providers' configuration shapes, even if they use only one or none.
- **Extensibility risk**: Adding a new database provider (e.g., SQLite, Oracle) should not require modifying `@ts-linq/types`. Currently, the pattern implies it does.
- **API stability risk**: A change to MySQL's connection options (e.g., a new TLS field required by a new MySQL version) forces a version bump in the foundation types package, affecting all consumers.
- **Clean Architecture violation**: The `types` layer (innermost ring) knows about infrastructure (outermost ring). This is the inverse of the correct dependency direction.

## Recommended Fix

1. Move `PostgresConfig` into `packages/provider-postgres/src/` (or `packages/dialect-postgres/src/`)
2. Move `MySqlConfig` into `packages/provider-mysql/src/` (or `packages/dialect-mysql/src/`)
3. Move `MssqlConfig` into `packages/provider-mssql/src/` (or `packages/dialect-mssql/src/`)
4. If `BaseProviderConfig` contains truly generic fields (host, port, database, credentials), keep it in `@ts-linq/types`; otherwise move it to `@ts-linq/core` alongside `DatabaseProvider`
5. For backward compatibility, re-export from current locations with a deprecation notice for one major version

## Acceptance Criteria

- `@ts-linq/types/src/index.ts` does not export any type whose name contains a specific database engine name
- `PostgresConfig`, `MySqlConfig`, `MssqlConfig` are exported from their respective provider or dialect packages
- `@ts-linq/types` has no knowledge of any specific SQL engine
- Existing consumers importing these types from `@ts-linq/types` receive a deprecation warning (TypeScript `@deprecated` JSDoc)
