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
- integration-nestjs — NestJS integration (UNIMPLEMENTED placeholder)
- testkits — test utilities
- typescript-config — shared tsconfig presets (base/node/esm)
- eslint-config — shared ESLint 9 flat config
- jest-config — shared Jest config factories
- integration-tests, e2e-tests — test suites
- examples — example apps

## ORM API Pattern (as of 2026-05-19, post-audit-v5)
- **EF Core-style API**: `DbSet<T>` exposes all `Queryable<T>` methods directly. Intermediate `.query()` removed.
- **`defineSet()` injection** (ISSUE-001 fixed, PR #74): `DbContext` no longer returns a Proxy from constructor. `defineSet()` helper used for `DbSet` property injection; removes `as unknown as this` cast.
- **Lambda selectors** via `extractKey()` Proxy helper: `orderBy`, `orderByDescending`, `thenBy`, `thenByDescending`, `include`, `innerJoinOn`, `leftJoinOn` accept a key string OR single-property lambda. Throws on nested paths (ISSUE-002 fixed, PR #72).
- **`OrderedQueryable<T>`** (ISSUE-007 fixed, PR #73): Encodes ordering state; `thenBy`/`thenByDescending` only available after `orderBy`/`orderByDescending`.
- **`internal/` sub-path exports** (ISSUE-006 fixed, PR #75): Internal services moved under `internal/` subfolder, stripped from public barrels.
- **`thenInclude()`**: Nested eager loading via `IncludePlanner` + `MetadataStorage`.
- Key files: `packages/orm/src/DbSet.ts`, `packages/orm/src/DbContext.ts`, `packages/query/src/Queryable.ts`, `packages/query/src/IncludePlanner.ts`

## Document & Task Structure
- Audit issues: `project-documents/issues/issues-v4/` (23 issues) and `project-documents/issues/issues-v5/` (11 issues)
- Dev plans (EF Core feature parity): `project-documents/tasks/dev-plans/` — 48 tasks P0/P1/P2 (P0-01 through P2-48)
- **NOTE**: CLAUDE.md instructs writing findings to `issues-v4/` (repo root) — but actual path is `project-documents/issues/issues-vN/`

## Audit Status (as of 2026-05-19)

### Audit v4 — `project-documents/issues/issues-v4/` — 23 issues
- **21/23 FIXED**: all Critical, High, Medium; 1 Low fixed
- **Open**: ISSUE-019 (Low) — `@ts-linq/integration-nestjs` unimplemented placeholder

### Audit v5 — `project-documents/issues/issues-v5/` — 11 issues (post PR #66 EF Core API)
- **8/11 FIXED**: ISSUE-001, 002, 004, 005, 006, 007, 008, 011
- **Open (3)**:
  - ISSUE-003 (High) — `DbSet` god class regression: 53 public methods, 515 LOC
  - ISSUE-009 (Low) — `Queryable.ts` still ~942 LOC
  - ISSUE-010 (Low) — `@ts-linq/integration-nestjs` still placeholder (carry-over from v4 ISSUE-019)

## Recent PRs (as of 2026-05-19)
- PR #80: fix(e2e): fix all e2e tests for postgresql and mysql
- PR #79: fix(e2e): docker e2e configuration
- PR #78: docs: add Implementation order section
- PR #77: docs: reorganise docs
- PR #76: fix(core): decompose LazyLoadingProxy and BatchOperations (ISSUE-008)
- PR #75: fix(api): internal/ sub-path export (ISSUE-006)
- PR #74: fix(orm): replace Proxy constructor with defineSet() (ISSUE-001)
- PR #73: feat(query,orm): OrderedQueryable<T> (ISSUE-007)

## Runtime
- Node.js, Darwin (macOS) development environment
- reflect-metadata is required (decorator metadata)
- Mechanical tools (arch:cycles, arch:deps, arch:dead, typecheck) all pass with 0 findings on main
