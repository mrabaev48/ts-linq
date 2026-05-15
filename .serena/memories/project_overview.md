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
- integration-tests, e2e-tests — test suites
- examples — example apps

## Runtime
- Node.js, Darwin (macOS) development environment
- reflect-metadata is required (decorator metadata)
