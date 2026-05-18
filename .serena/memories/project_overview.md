# ts-linq — Project Overview

## Purpose
TypeScript ORM inspired by Entity Framework Core: decorator-based entities, change tracking, and LINQ-style fluent querying.

Supported databases: PostgreSQL, MySQL, Microsoft SQL Server.

## Tech Stack
- Language: TypeScript (^5.4.5)
- Package manager: pnpm (10.18.3) with workspaces
- Build orchestration: Turborepo (turbo)
- Bundler: Rollup
- Testing: Jest + ts-jest, testcontainers (integration/e2e)
- Linting: ESLint + @typescript-eslint + prettier
- Formatting: Prettier
- Docs: TypeDoc
- Commit hooks: Husky + commitlint
- Architecture analysis: dependency-cruiser, madge, ts-prune

## Monorepo Package Structure (packages/)
- core — main ORM engine
- orm — DbContext, DbSet
- query — LINQ-style query builder
- metadata — decorators (@Entity, @Column, @PrimaryKey)
- ast — compile-time AST transformer
- transformer — ts-patch transformer
- types — shared TypeScript types
- metrics-safe — safe metrics abstractions
- concurrency — concurrency utilities
- cache, cache-redis, cache-memcached — caching layers
- telemetry — OpenTelemetry integration
- open-telemetry-sql-logger, prometheus-sql-logger, composite-sql-logger — loggers
- dialect-postgres, dialect-mysql, dialect-mssql — SQL dialects
- provider-postgres, provider-mysql, provider-mssql — DB providers
- cli — CLI tool
- config — configuration
- migrations — migration engine
- pagination — pagination utilities
- sql-visitor — SQL AST visitor
- plugin-audit, plugin-soft-delete, plugin-multi-tenant — plugins
- integration-nestjs — NestJS integration
- testkits — test utilities
- typescript-config — shared tsconfig presets (base/node/esm)
- eslint-config — shared ESLint 9 flat config
- jest-config — shared Jest config factories
- integration-tests, e2e-tests — test suites
- examples — example apps

## ORM API Pattern (as of 2026-05-18, PR #66)
- **EF Core-style API**: `DbSet<T>` now exposes all `Queryable<T>` methods directly (~30 delegating chainable/terminal methods). The intermediate `.query()` step is removed.
- **Proxy-based injection**: `DbContext` constructor returns a `Proxy` that intercepts `DbSet` property assignments and injects context + registers them in the entity map. Supports `new DbSet(Entity)` property initializers.
- **Lambda selectors**: `orderBy`, `orderByDescending`, `thenBy`, `thenByDescending`, `include`, `innerJoinOn`, `leftJoinOn` all accept a key string OR lambda selector via `extractKey()` Proxy helper.
- **`thenInclude()`**: Added for nested eager loading (dot-notation paths resolved by `IncludePlanner` via `MetadataStorage`).
- Key files: `packages/orm/src/DbSet.ts`, `packages/orm/src/DbContext.ts`, `packages/query/src/Queryable.ts`, `packages/query/src/IncludePlanner.ts`

## Audit Status (as of 2026-05-18)
- Audit v4 in `issues-v4/` — 23 issues total
- **21/23 FIXED**: all Critical, High, Medium; 1 Low fixed
- **Open**: ISSUE-019 (Low) — `@ts-linq/integration-nestjs` is unimplemented placeholder
- TASK-001 done: shared config packages extracted (`typescript-config`, `eslint-config`, `jest-config`)

## Runtime
- Node.js, Darwin (macOS) development environment
- reflect-metadata is required (decorator metadata)
