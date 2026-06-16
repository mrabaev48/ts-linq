# ts-querable — Complete Project Specification

> **Purpose of this document**: A full specification of the `ts-querable` project intended for
> complete reimplementation from scratch. It covers: project overview, architecture, all packages,
> all features, technologies, engineering rules, workflow, skills, and references. A reader who
> follows this document should be able to reproduce the entire system without asking any additional
> questions.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Inspiration & References](#2-inspiration--references)
3. [Repository Layout & Tooling](#3-repository-layout--tooling)
4. [Architecture Overview](#4-architecture-overview)
5. [Package Catalog](#5-package-catalog)
   - 5.1 [Core ORM Layer](#51-core-orm-layer)
   - 5.2 [Query & AST Layer](#52-query--ast-layer)
   - 5.3 [Compile-Time Transformer](#53-compile-time-transformer)
   - 5.4 [Dialect Layer](#54-dialect-layer)
   - 5.5 [Provider Layer](#55-provider-layer)
   - 5.6 [Migrations](#56-migrations)
   - 5.7 [Metadata](#57-metadata)
   - 5.8 [Concurrency & Resilience](#58-concurrency--resilience)
   - 5.9 [Caching](#59-caching)
   - 5.10 [Observability & Logging](#510-observability--logging)
   - 5.11 [Plugins](#511-plugins)
   - 5.12 [CLI](#512-cli)
   - 5.13 [Integrations](#513-integrations)
   - 5.14 [Testing Infrastructure](#514-testing-infrastructure)
   - 5.15 [Shared Config Packages](#515-shared-config-packages)
6. [Feature Catalog (EF Core Parity Roadmap)](#6-feature-catalog-ef-core-parity-roadmap)
7. [Error Handling Architecture](#7-error-handling-architecture)
8. [Versioning & Release Workflow](#8-versioning--release-workflow)
9. [Engineering Rules & Conventions](#9-engineering-rules--conventions)
10. [Development Workflow (CLAUDE.md)](#10-development-workflow-claudemd)
11. [Task Template (TASK_TEMPLATE.md)](#11-task-template-task_templatemd)
12. [Available AI Skills](#12-available-ai-skills)
13. [Technologies Used](#13-technologies-used)
14. [Validation Commands](#14-validation-commands)
15. [Architecture Analysis Commands](#15-architecture-analysis-commands)
16. [Dependency Graph Rules](#16-dependency-graph-rules)

---

## 1. Project Overview

**ts-querable** is a production-grade, TypeScript-first ORM framework inspired by
[Microsoft Entity Framework Core](https://github.com/dotnet/efcore). It provides:

- **Decorator-based entity mapping** — `@Entity`, `@Column`, `@PrimaryKey`, relationship
  decorators.
- **Change tracking** — automatic detection of modifications to tracked entities.
- **LINQ-style fluent querying** — chainable, strongly typed `Queryable` API that mirrors EF Core's
  `IQueryable`.
- **Multi-database support** — PostgreSQL, MySQL, Microsoft SQL Server out of the box.
- **Compile-time predicate transformer** — TypeScript build-time rewriting of `where(u => ...)` to
  an AST-backed representation (no runtime source parsing).
- **Schema migrations** — first-class snapshot-based diffing and migration runner with history
  tracking.
- **DB-first scaffolding** — reverse-engineer an existing database into TypeScript entity classes.
- **AOT compiled models** — cache model configuration to accelerate start-up.
- **Observability** — pluggable SQL logging, OpenTelemetry spans, Prometheus metrics.
- **Caching** — SQL query caching backed by Redis or Memcached.
- **Plugins** — audit logging, soft delete, multi-tenancy via the `OrmMiddleware` pipeline.

### Quick-start example

```ts
import 'reflect-metadata';
import { DbContext, DbSet } from '@ts-querable/orm';
import { Column, Entity, PrimaryKey } from '@ts-querable/metadata';

@Entity({ name: 'users' })
class User {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT', nullable: false })
  name!: string;
}

class AppDbContext extends DbContext {
  public users!: DbSet<User>;
}

async function main() {
  const ctx = new AppDbContext({
    provider: 'postgresql',
    connectionString: 'postgres://postgres:postgres@localhost:5432/ts_linq',
  });

  ctx.register(User);
  await ctx.ensureCreated();

  const u = new User();
  u.name = 'Alice';
  ctx.users.add(u);
  await ctx.saveChanges();

  const all = await ctx.users.orderBy((x) => x.id).toArray();
  console.log(all);

  await ctx.dispose();
}
```

### Compile-time transformer setup

The transformer hooks into the TypeScript compilation pipeline and rewrites:

```ts
q.where(u => u.age >= minAge && !u.isActive)
```

into an AST-backed `q.whereCompiled({ ast, parameters })` call before the JavaScript is emitted.
This means **no runtime source-string parsing** — the predicate is a typed data structure at
runtime.

**Setup with ts-patch:**

```bash
npm i -D ts-patch
npx ts-patch install
```

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [{ "transform": "@ts-querable/transformer" }]
  }
}
```

```bash
npx tspc -p tsconfig.json
```

### Supported expression subset (transformer v1)

| Construct | Representation |
|---|---|
| `ArrowFunction` (single param, expression body) | top-level predicate |
| `&&` | `LogicalOperator.And` |
| `\|\|` | `LogicalOperator.Or` |
| `!` | `UnaryOperator.Not` |
| `===`, `==`, `>`, `>=`, `<`, `<=` | `BinaryOperator.*` |
| Member access rooted at the lambda param | `MemberAccess` node |
| Literals (`number\|string\|boolean\|null`) | `Literal` node |
| Closure values (no lambda param references) | captured `Parameter` node |

### Local PostgreSQL via Docker

```bash
docker compose up -d
export POSTGRES_URL='postgres://postgres:postgres@localhost:5432/ef_test'
```

---

## 2. Inspiration & References

- **Microsoft Entity Framework Core**: https://github.com/dotnet/efcore
  The primary design reference. Every public API in ts-querable mirrors the corresponding EF Core API
  verbatim (method names, chaining order, semantics). Internal implementation is free to deviate.

- EF Core documentation: https://learn.microsoft.com/en-us/ef/core/

The roadmap (`project-documents/tasks/dev-plans/README.md`) tracks all EF Core features and their
parity status, organized in three priority tiers: P0 (foundation), P1 (important parity), P2
(advanced), plus RF (refactor) tasks.

---

## 3. Repository Layout & Tooling

### Monorepo structure

```
ts-querable/
├── packages/                        # All packages live here
│   ├── types/                       # @ts-querable/types — zero-dep shared contracts
│   ├── ast/                         # @ts-querable/ast — query AST nodes
│   ├── metadata/                    # @ts-querable/metadata — entity mapping model
│   ├── sql-visitor/                 # @ts-querable/sql-visitor — AST → SQL visitor
│   ├── core/                        # @ts-querable/core — abstract DatabaseProvider + loading
│   ├── query/                       # @ts-querable/query — Queryable fluent API
│   ├── transformer/                 # @ts-querable/transformer — compile-time rewriter
│   ├── orm/                         # @ts-querable/orm — DbContext, DbSet, change tracking
│   ├── migrations/                  # @ts-querable/migrations — schema diffing + runner
│   ├── concurrency/                 # @ts-querable/concurrency — retry/execution strategy
│   ├── metrics-safe/                # @ts-querable/metrics-safe — safe metrics no-ops
│   ├── telemetry/                   # @ts-querable/telemetry — OTel integration
│   ├── cache/                       # @ts-querable/cache — cache policy contracts
│   ├── cache-redis/                 # @ts-querable/cache-redis — Redis adapters
│   ├── cache-memcached/             # @ts-querable/cache-memcached — Memcached adapters
│   ├── dialect-postgres/            # @ts-querable/dialect-postgres — Postgres SQL dialect
│   ├── dialect-mysql/               # @ts-querable/dialect-mysql — MySQL SQL dialect
│   ├── dialect-mssql/               # @ts-querable/dialect-mssql — MSSQL T-SQL dialect
│   ├── provider-postgres/           # @ts-querable/provider-postgres — Postgres runtime
│   ├── provider-mysql/              # @ts-querable/provider-mysql — MySQL runtime
│   ├── provider-mssql/              # @ts-querable/provider-mssql — MSSQL runtime
│   ├── composite-sql-logger/        # @ts-querable/composite-sql-logger — fan-out logger
│   ├── open-telemetry-sql-logger/   # @ts-querable/open-telemetry-sql-logger — OTel SqlLogger
│   ├── prometheus-sql-logger/       # @ts-querable/prometheus-sql-logger — Prometheus SqlLogger
│   ├── pagination/                  # @ts-querable/pagination — pagination helpers (WIP)
│   ├── plugin-audit/                # @ts-querable/plugin-audit — audit middleware
│   ├── plugin-soft-delete/          # @ts-querable/plugin-soft-delete — soft-delete middleware
│   ├── plugin-multi-tenant/         # @ts-querable/plugin-multi-tenant — multi-tenant middleware
│   ├── cli/                         # @ts-querable/cli — ts-querable CLI
│   ├── integration-nestjs/          # @ts-querable/integration-nestjs — NestJS module (stub)
│   ├── testkits/                    # @ts-querable/testkits — test utilities
│   ├── eslint-config/               # @ts-querable/eslint-config — shared ESLint config
│   ├── jest-config/                 # @ts-querable/jest-config — shared Jest config
│   └── typescript-config/           # @ts-querable/typescript-config — shared tsconfig bases
├── project-documents/
│   └── tasks/dev-plans/             # EF Core parity task plans (P0/P1/P2/RF)
├── issues-v4/                       # Audit findings (one .md per issue)
├── reports/                         # Architecture analysis outputs (dep-cruiser, madge)
├── .changeset/                      # Changesets configuration
├── CLAUDE.md                        # Agent engineering rules (see §10)
├── SPEC.md                          # This file
├── turbo.json                       # Turborepo task pipeline
├── pnpm-workspace.yaml              # pnpm workspaces
├── .dependency-cruiser.cjs          # dependency-cruiser rules
├── ts-prune-ignore.txt              # ts-prune allowlist
└── docker-compose.yml               # Local Postgres for development
```

### Package manager

- **pnpm** `10.18.3` with workspaces.

### Build system

- **Turborepo** (`turbo`) — task pipeline, caching, `--filter`/`--affected` runs.
- Each package builds with `tsc` (TypeScript compiler) to `dist/esm/`.
- Output format: ESM only (`"type": "module"` or explicit `.mjs`).

### Toolchain versions

| Tool | Version |
|---|---|
| TypeScript | `^5.4.5` |
| Node.js | `^24.x` |
| pnpm | `10.18.3` |
| Turborepo | `^2.5.8` |
| Jest | `^29.7.0` |
| ts-jest | `^29.4.5` |
| ts-patch | `^3.3.0` |
| ESLint | `^9.x` |
| Prettier | `^3.x` |
| Changesets | `^2.31.0` |
| dependency-cruiser | `^17.x` |
| madge | `^8.x` |
| ts-prune | `^0.10.x` |
| tsd | `^0.30.x` |
| typedoc | `^0.28.x` |

---

## 4. Architecture Overview

### Layered architecture

```
┌─────────────────────────────────────────────────────┐
│  Application code                                   │
│  @ts-querable/orm  ·  @ts-querable/cli                      │
├────────────────────────┬────────────────────────────┤
│  @ts-querable/query        │  @ts-querable/migrations       │
│  (Queryable, EF, cache)│  (runner, diff, scaffold)  │
├────────────────────────┴────────────────────────────┤
│  @ts-querable/core                                      │
│  (DatabaseProvider, loading, batch, interceptors)   │
├──────────────┬──────────────────────────────────────┤
│  @ts-querable/   │  @ts-querable/sql-visitor                │
│  metadata    │  (AST → SQL, dialect ports)          │
├──────────────┴──────────────────────────────────────┤
│  @ts-querable/ast          @ts-querable/types               │
│  (AST nodes, spec)     (zero-dep contracts)         │
├───────────────────────────────────────────────────┐ │
│  Dialects: dialect-postgres / mysql / mssql       │ │
├───────────────────────────────────────────────────┤ │
│  Providers: provider-postgres / mysql / mssql     │ │
└───────────────────────────────────────────────────┘ │
```

### Dependency direction rules

- Dependencies always point **inward** (toward `@ts-querable/types`).
- `@ts-querable/types` depends on **nothing**.
- `@ts-querable/ast` depends only on `@ts-querable/types`.
- `@ts-querable/sql-visitor` depends on `@ts-querable/ast` and `@ts-querable/types`.
- Dialects depend on `sql-visitor`, `types`, `metadata`, and `core`.
- Providers depend on their corresponding dialect plus `core`, `types`, and `metadata`.
- `@ts-querable/core` depends on `types`, `metadata`, `metrics-safe`, `ast`.
- `@ts-querable/query` depends on `types`, `metrics-safe`, `ast`, `sql-visitor`, `core`, `metadata`.
- `@ts-querable/orm` depends on `concurrency`, `core`, `metadata`, `metrics-safe`, `migrations`,
  `query`, `sql-visitor`, `telemetry`, `types`.
- No circular dependencies anywhere.
- Public APIs go through package entrypoints (`index.ts`). Internals are exported under
  `./internal` subpaths where necessary.

### Key design patterns

| Pattern | Where used |
|---|---|
| **Visitor** | `SqlVisitor` walking AST nodes; per-node visitor classes |
| **Strategy** | `SqlDialect`, `DdlStrategy`, `ExecutionStrategy`, `RetryPolicy`, `SchemaInspector` |
| **Factory** | `SqlVisitorFactory`, `SchemaInspectorFactory`, `SqlQuoterFactory` |
| **Template Method** | `DatabaseProvider` (abstract hooks), `EntityMetadataState.mutate()` |
| **Decorator (GoF)** | `SafeSqlLogger`, `MetricsCacheDecorator`, `TtlCacheDecorator`, `CompositeSqlLogger` |
| **Builder** | `ModelBuilder`, `EntityTypeBuilder`, `MigrationBuilder`, `DbContextOptionsBuilder` |
| **Facade** | `Queryable` (thin facade over 10+ collaborator classes) |
| **Null Object** | `EmptyMetadataSource`, `NO_OP` loggers |
| **CoR (Chain of Responsibility)** | `@ts-querable/transformer` call visitors (Array/Identifier/String/EfFunction handlers) |
| **Specification** | `Specification<T>` in `@ts-querable/ast` |

### Transformer architecture (target state)

> **IMPORTANT — Required change**: The `@ts-querable/transformer` currently uses the raw TypeScript
> Compiler API directly (`import * as ts from 'typescript'`). The **target architecture** requires
> migrating to **ts-morph** (`ts-morph` npm package) on top of the Compiler API, for:
> - Simpler, higher-level AST traversal and manipulation.
> - Easier node inspection and type resolution.
> - Reduced boilerplate for `TransformerFactory` wiring.
> - Safer scope guards with `ts-morph` type system helpers.
>
> The existing raw-Compiler-API approach should be replaced with `ts-morph` while preserving
> the current external contract (plugin entry point, AST output format, diagnostics surface).

---

## 5. Package Catalog

### 5.1 Core ORM Layer

#### `@ts-querable/types`

> **Zero runtime dependencies.** Pure type definitions and the project's only cross-cutting runtime
> contracts.

**Role**: canonical home for every shared contract in the ORM. Every other package depends on it;
it depends on nothing.

**Concern modules** (internal, all re-exported through a single barrel `index.ts`):

| Module | Key exports |
|---|---|
| `sql.ts` | `SqlParameter`, `WhereClause`, `QueryOptions`, `FilteredIncludeSpec` |
| `logging.ts` | `Logger`, `SqlLogger`, `SqlLoggerFactory`, `QueryStartInfo`, `QueryEndInfo`, `CircuitState` |
| `dialect.ts` | `SqlDialect`, `SqlWithParams`, `BatchInsertResult` |
| `middleware.ts` | `OrmMiddleware`, `RetryPolicy`, `ExecutionStrategyOptions`, `BeforeExecuteInfo` |
| `config.ts` | `BaseProviderConfig`, `PostgresConfig`, `MySqlConfig`, `MssqlConfig`, `AuditOptions` |
| `query-filters.ts` | `GlobalFilter`, `QueryFilterMetadata` |
| `results.ts` | `Result<T,E>`, `FallbackPolicy`, `QueryFallback` |
| `cache.ts` | `SqlCache`, `TemplateSqlCache`, `PerformanceOptions`, `EntityCacheLike` |
| `value-conversion.ts` | `ValueConverterLike`, `ValueComparerLike`, `ValueGenerator`, `SequenceMetadata` |
| `metadata.ts` | `EntityMetadata`, `ColumnMetadata`, `RelationshipMetadata`, `JsonShape`, `EntityCtor`, `EntityRef` |
| `stored-procedure.ts` | `SpCallSyntax`, `StoredProcedureConfig`, `SpParameterMapping` |
| `tracking.ts` | `TrackedEntity` |
| `enums.ts` | `EntityState`, `LoadingStrategy`, `ValueGeneratedPolicy`, `DeleteBehavior`, `StorageStrategy`, `InheritanceStrategy`, `QuerySplittingBehavior` |
| `runtime.ts` | `ok()`, `err()`, `isTemplateSqlCache()` |
| `spatial-hierarchy.ts` | `SpatialTranslator`, `HierarchyIdTranslator` |
| `diagnostics.ts` | `LogLevel`, `WarningBehavior`, `DiagnosticConfig` |
| `scaffolding.ts` | `DatabaseModel`, `DbIntrospector`, `ScaffoldOptions` |
| `errors.ts` | `OrmError`, `OrmErrorCode`, all concrete error classes |

**Runtime surface**: Only `runtime.ts` (3 helpers), `enums.ts` (7 string enums), and `errors.ts`
(error classes) emit JavaScript. Everything else is type-only.

**Dependencies**: none.

---

#### `@ts-querable/core`

> The abstract runtime that every concrete provider implements.

**Role**: Defines `DatabaseProvider` (the abstract contract), provides all mapping decorators,
relationship loading (eager + lazy), batch operations, the interceptor pipeline, DDL generation,
resilience, and domain helpers (spatial, hierarchy-id, owned-entity hydration).

**Key exports**:

- `DatabaseProvider` — abstract base class. Provides: `connect`, `disconnect`, `query`,
  `executeNonQuery`, `beginTransaction`, `commitTransaction`, `rollbackTransaction`,
  `executeBatch`, `buildDdl`, `quoteIdentifier`, `queryJunction` (capability port).
- Decorators: `@Entity`, `@Column`, `@PrimaryKey`, `@OneToMany`, `@ManyToOne`, `@OneToOne`,
  `@ManyToMany`, `@CachePolicy`, `@ValidIf` (re-exporting metadata wiring).
- `EntityLoader` — eager relationship loading orchestrator (decomposed into strategy registry +
  shared support collaborators).
- `RelationshipLoader` — loads relationships via FK or junction table.
- `LazyLoadingProxy` — ES6 Proxy-based lazy loader with injected logger.
- `BatchExecutor` — `BatchInsert`, `BatchUpdate`, `BatchDelete`, `BatchUpsert`.
- Interceptors: `IDbCommandInterceptor`, `IDbConnectionInterceptor`, `IDbTransactionInterceptor`,
  `IMaterializationInterceptor`, `ISaveChangesInterceptor`, `InterceptionResult`.
- `DdlBuilder`, `DdlStrategy` — DDL generation.
- `ResilienceManager`, `HealthMonitor` — resilience and health-check utilities.
- Spatial and hierarchy-id helpers.

**Internal structure** (post-refactor):

```
src/
  DatabaseProvider.ts                   # abstract contract (thin facade)
  provider/
    ProviderConfig.ts                   # configuration collaborator
    CompositeSqlLogger.ts               # logger fan-out
    InterceptorDispatcher.ts            # interceptor pipeline
    QueryAnalyzer.ts                    # query analysis
    QueryExecutionPipeline.ts           # execution pipeline
    MiddlewareDispatcher.ts             # middleware dispatch
    BatchTransactionRunner.ts           # batch + transaction
    SavepointStrategy.ts, SequenceStrategy.ts
  decorators/                           # @Entity, @Column, etc.
  loading/
    EntityLoader.ts                     # orchestrator
    RelationshipLoader.ts
    strategies/                         # loading strategies registry
    support/                            # FK convention, grouper, chunker, etc.
    lazy/LazyLoadingProxy.ts
  batch/                                # BatchExecutor + per-operation builders
  interceptors/
  ddl/DdlBuilder.ts, DdlStrategy.ts
  resilience/, health/
  spatial/, hierarchy/
  index.ts
```

**Dependencies**: `@ts-querable/types`, `@ts-querable/metadata`, `@ts-querable/metrics-safe`, `@ts-querable/ast`.

---

#### `@ts-querable/orm`

> The high-level developer-facing ORM package.

**Role**: The package application code imports directly. Composes `core`, `query`, `metadata`, and
`migrations` into an EF-style DX: define `DbContext`, configure with builders, query via `DbSet`,
mutate tracked entities, call `saveChanges()`.

**Key exports**:

- `DbContext` — unit-of-work root. Owns `ChangeTracker`, manages transactions, exposes
  `saveChanges()`, `ensureCreated()`, `dispose()`.
- `DbContextOptionsBuilder` — fluent options configuration (connection, logging, cache, warning
  behavior).
- `DatabaseFacade` — `Database.ExecuteSql*`, `Database.BeginTransaction`.
- `DbSet<T>` — extends `Queryable<T>`; provides `add()`, `remove()`, `attach()`, `update()`.
- `ChangeTracker` — detects entity state changes (added/modified/deleted/unchanged/detached).
- `ChangeTrackerFacade`, `EntityEntry<T>`, `PropertyEntry<T>`, `IdentityMap`, `LocalView<T>`.
- `ModelBuilder` — `OnModelCreating` root; delegates to `EntityTypeBuilder<T>`.
- `EntityTypeBuilder<T>` + `builders/*` — navigation, owned types, complex types, indexes,
  sequences, discriminators, DB functions, stored procedures.
- `HiLoValueGenerator`, `UlidValueGenerator`, `UuidV7ValueGenerator`, `UtcNowValueGenerator`.
- `DbContextTransaction`, batch executor/grouper, `sql` interpolation tag.
- `DbContextPool`, `PooledDbContextFactory`, `DbContextFactory`.
- `DbUpdateConcurrencyException`, `KeylessMutationError`.

**Dependencies**: `concurrency`, `core`, `metadata`, `metrics-safe`, `migrations`, `query`,
`sql-visitor`, `telemetry`, `types`.

---

### 5.2 Query & AST Layer

#### `@ts-querable/ast`

> Pure data layer: the intermediate representation between LINQ lambdas and SQL generation.

**Key exports**:

- `Nodes.ts` — the AST node union: `BinaryNode`, `LogicalNode`, `UnaryNode`, `LiteralNode`,
  `MemberAccessNode`, `MethodCallNode`, `ParameterNode`, etc.
- `JsonPathExpression.ts` — JSON column path access model.
- `RawSqlNode.ts` — escape-hatch node carrying pre-rendered SQL fragments.
- `Specification<T>` — composable predicate objects with `.and()`, `.or()`, `.not()`.

**Dependencies**: `@ts-querable/types`.

---

#### `@ts-querable/sql-visitor`

> Visitor layer: walks the query AST and emits parameterized SQL.

**Role**: The shared SQL generation engine. Translates AST nodes to SQL fragments while delegating
identifier quoting, function translation, JSON-path rendering, and parameter style to the active
dialect via injected ports.

**Key exports** (public barrel):

- `SqlVisitor` — entry point; configured with `SqlVisitorOptions` (dialect translators +
  resolvers).
- `SqlVisitorOptions` — assembles converters + dialect translators; used by `SqlVisitorFactory` in
  `@ts-querable/query`.
- `ParameterState`, `ParameterStyle` — positional `?`, `$1`, `@p0`, etc.
- Per-node visitors: `BinaryVisitor`, `LogicalVisitor`, `UnaryVisitor`, `NullVisitor`,
  `InVisitor`, `MethodVisitor`, `JsonPathVisitor`, `EfFunctionVisitor`,
  `HierarchyMethodVisitor`, `SpatialMethodVisitor`, `FragmentJoinPlanner`.
- Rewriters: `JsonAccessRewriter`, `ComplexAccessRewriter`.
- Batch emit helpers: `buildQuestionMarkRows`, `calcChunkSize`, `chunkArray`.
- SP helpers: `CallSyntaxEmitter`, `ExecSyntaxEmitter`.
- Tag helper: `emitTagComments`.
- Ports: `EfFunctionTranslator`, `JsonPathTranslator`, `ColumnResolver`, `ConverterResolver`.

**Internal subpath** (`./internal`): `SchemaInspector` and sub-visitors not part of the public
contract.

**Dependencies**: `@ts-querable/ast`, `@ts-querable/types`.

---

#### `@ts-querable/query`

> The fluent strongly-typed query API, execution pipeline, EF helpers, caching, and fallbacks.

**Role**: Turns AST-backed query expressions into executed SQL and materialized entities. Provides
the chainable `Queryable`/`TypedQueryable` surface, the execution pipeline, the `EF` functions
namespace, include planning, pagination, query tags, and the caching layer.

**Key exports** (public barrel `.`):

- `Queryable<T>` — thin facade over 10 stateless collaborators (decomposed via Task-1 refactor):
  `TrackingCoordinator`, `CountCoordinator`, `StreamingExecutor`, `SetOperationBuilder`,
  `BulkDmlExecutor`, `QueryRunner`, `JoinBuilder`, `InheritanceQueryPlanner`, `PredicateBuilder`,
  `IncludeBuilder`.
- `TypedQueryable<T>` — fully typed subclass.
- `QueryBuilder` — builds `QueryModel` from fluent calls.
- `QueryModel` — immutable value object holding the query state (select, where, order, join,
  include, skip, take, groupBy, having, …). Carries `QueryContext` (10 fields: dialect,
  logger, cache, tracker, filter map, etc.).
- `EF` — `EF.functions` (database functions namespace), `EF.property()` (shadow property marker),
  `EF.CompileQuery`, `EF.CompileAsyncQuery`.
- `SqlCache`, `InMemorySqlCache`, `EnhancedSqlCache`, `CountCache`, `LruCache`,
  `MetricsCacheDecorator`, `TtlCacheDecorator`.
- `FallbackManager`, `MemoryFallback`.
- `GlobalFilterApplier` — applies `hasQueryFilter` predicates; fail-closed (security).
- `IncludeSelectorResolver` — resolves filtered include via discriminated `IncludeResolution`.
- `RowMaterializer`, `IncludePlanner`.
- `PaginationBuilder`, `AsyncQueryable`.
- `tag-with`, `tag-with-call-site`, `sanitizeTag`.
- `SetPropertyCalls` — `ExecuteUpdate`-style setters.

**Internal subpath** (`./internal`): `QueryContext`, `SqlVisitorFactory`, `LruCache`,
`LruCacheOptions`, collaborator classes. Consumed by `@ts-querable/orm` composition roots and
integration tests.

**Immutability**: Every chainable method (`.where()`, `.orderBy()`, `.include()`, etc.) clones the
`QueryModel` via `withModel(model, draft)` and returns a new `Queryable`. The original is never
mutated (fork-safety guaranteed).

**Dependencies**: `types`, `metrics-safe`, `ast`, `sql-visitor`, `core`, `metadata`.

---

### 5.3 Compile-Time Transformer

#### `@ts-querable/transformer`

> TypeScript compiler plugin that rewrites LINQ-style lambda expressions to AST nodes at build
> time.

**Role**: Plugs into the TypeScript compilation pipeline (via `ts-patch` / `ttypescript` / bundler
TS plugin) and converts arrow-function predicates inside `.where(...)`, `.having(...)`,
`.select(...)`, and `hasQueryFilter(...)` calls into serializable `@ts-querable/ast` nodes.

**Current implementation**: uses the TypeScript Compiler API directly (`import * as ts from
'typescript'`).

**Target architecture — REQUIRED CHANGE**: Migrate from the raw Compiler API to **ts-morph**
(`ts-morph` npm package). ts-morph wraps the Compiler API with a higher-level, more ergonomic API
for AST traversal and manipulation. Benefits:

- Simpler node inspection (`node.getType()`, `node.getDescendants()`, etc.).
- Easier type resolution without manually threading `TypeChecker` everywhere.
- Cleaner `SourceFile` / `Project` abstractions.
- Less boilerplate for `TransformerFactory` wiring.
- More readable scope guards.

The external contract (plugin entry point `tsLinqTransformer`, AST output format, `DiagnosticSink`
interface) must be preserved during the migration.

**Key exports**:

- `tsLinqTransformer` (default export) — the `TransformerFactory` entry point wired into ts-patch.
- `transformExpression`, `ExpressionDispatcher`, `TransformContext`.
- Rewriters: `WhereHavingRewriter`, `SelectRewriter`, `HasQueryFilterRewriter`.
- Scope guards: `QueryableGuard`, `EntityTypeBuilderGuard`.
- `DiagnosticSink` — surfaces transform-time diagnostic messages.
- `buildVisitor` — shared visitor dispatch (Chain-of-Responsibility): `ArrayCallHandler`,
  `IdentifierCallHandler`, `StringCallHandler`, `EfFunctionCallHandler`.
- Node builders: helpers emitting AST node literals.
- `CallRewriteVisitor` — owns the dispatch map; both entrypoints (`createWhereTransformer` and
  `tsLinqTransformer`) are thin adapters over it.

**Internal structure**:

```
src/
  index.ts                          # tsLinqTransformer (ts-patch entry, thin adapter)
  CallRewriteVisitor.ts             # shared buildVisitor + DISPATCH map
  expression/
    transformExpression.ts
    ExpressionDispatcher.ts
    TransformContext.ts
  rewriters/                        # WhereHaving / Select / HasQueryFilter
  scope/                            # QueryableGuard, EntityTypeBuilderGuard
  diagnostics/DiagnosticSink.ts
  nodes/                            # AST node literal builders
  calls/                            # CoR handlers: Array/Identifier/String/EfFunction
  visitors/EFCompileQueryVisitor.ts
```

**Dependencies**: `@ts-querable/ast`, `@ts-querable/types`. Peer: `typescript ^5.4.5`.

**Target additional dependency**: `ts-morph` (once migration is complete).

---

### 5.4 Dialect Layer

Dialects implement `SqlDialect` from `@ts-querable/types` and the emitter/translator ports from
`@ts-querable/sql-visitor`. They produce database-specific SQL without touching runtime
connection/query logic.

#### `@ts-querable/dialect-postgres`

Postgres-flavored SQL: `$1` parameters, `"ident"` quoting, `ON CONFLICT` upserts, `->` / `->>`
JSON access, `ltree`, `JSONB` DDL, spatial functions, `RETURNING` clauses.

Key exports: `PostgresDialect`, `PostgresDdlStrategy`, `PostgresOptionsBuilder`,
`PgWhereEmitter`, `PgJoinEmitter`, `PgGroupEmitter`, `PgOrderEmitter`, `PgIndexBuilder`,
`JsonPathTranslator`, `ltree-functions`, `spatial-functions`, `introspector` (DB-first),
`batch-syntax`, `sp-syntax`.

#### `@ts-querable/dialect-mysql`

MySQL-flavored SQL: `?` parameters, backtick `` ` `` quoting, `ON DUPLICATE KEY UPDATE` upserts,
`JSON_EXTRACT` / `->>` JSON access, `LAST_INSERT_ID`, `AUTO_INCREMENT`, sequence emulation via
counter table.

Key exports: `MysqlDialect`, `MySqlDdlStrategy`, `MysqlOptionsBuilder`, `MySqlWhereEmitter`,
`MySqlJoinEmitter`, `MySqlGroupEmitter`, `MySqlOrderEmitter`, `MySqlIndexBuilder`,
`JsonPathTranslator`, `sequenceEmulation`, `spatial-functions`, `introspector`, `batch-syntax`,
`sp-syntax`.

#### `@ts-querable/dialect-mssql`

T-SQL: `@p0` parameters, `[ident]` quoting, `MERGE` upserts, `JSON_VALUE` / `JSON_QUERY` access,
`hierarchyid`, temporal `FOR SYSTEM_TIME`, `OUTPUT INSERTED`, `OFFSET … FETCH`.

Key exports: `MssqlDialect`, `MssqlDdlStrategy`, `MssqlOptionsBuilder`, `MssqlWhereEmitter`,
`MssqlJoinEmitter`, `MssqlGroupEmitter`, `MssqlOrderEmitter`, `MssqlIndexBuilder`,
`JsonPathTranslator`, `emit-temporal`, `hierarchy-functions`, `spatial-functions`, `introspector`,
`batch-syntax`, `sp-syntax`.

**Dependencies** (all three dialects): `@ts-querable/metadata`, `@ts-querable/sql-visitor`,
`@ts-querable/types`, `@ts-querable/core`.

---

### 5.5 Provider Layer

Providers implement the `DatabaseProvider` abstract class from `@ts-querable/core`. They own
connections/pooling, execute parameterized SQL, map rows to entities, coerce JS values to SQL
parameters, handle transactions, and classify transient errors.

#### `@ts-querable/provider-postgres`

- `PostgresProvider` — implements `DatabaseProvider` on top of `pg` (node-postgres).
- `buildConnectionString` — connection config → connection string.
- `spatial-codec` — WKB/WKT codecs for PostGIS.
- `ltree-codec` — ltree codec for hierarchy queries.
- `transientErrorCodes` — retryable Postgres error codes.

Peer dependency: `pg` driver.

#### `@ts-querable/provider-mysql`

- `MySqlProvider` — implements `DatabaseProvider` on top of `mysql2`.
- `buildConnectionString`.
- `spatial-codec` — WKB/WKT.
- `transientErrorCodes`.

Peer dependency: `mysql2` driver.

#### `@ts-querable/provider-mssql`

- `MssqlProvider` — implements `DatabaseProvider` on top of `mssql` / `tedious`.
- `buildConnectionString`.
- `spatial-codec`, `hierarchy-codec` — WKB/WKT + hierarchyid encoding.
- `transientErrorCodes`.

Peer dependency: `mssql` or `tedious` driver.

---

### 5.6 Migrations

#### `@ts-querable/migrations`

> Schema migrations, schema diffing, migration runner, idempotent script/bundle generation, and
> DB-first scaffolding.

**Key exports** (public barrel `.`):

- `MigrationRunner` — thin orchestrator over injected:
  - `MigrationHistoryStore` (history tracking, `__migrations` table via `information_schema`
    probes — NOT catch-based).
  - `TransactionScope`.
  - `MigrationLogger`.
- `Migration`, `MigrationBuilder`, `MigrationFileBuilder`, `MigrationTemplate`.
- `SchemaComparator`, `SchemaInspector` (interface), `SchemaInspectorFactory.for(label, provider)`
  — single dialect-selection point (Factory + ISP + DIP).
- `DiffMigrationGenerator`, `DiffBasedMigration`.
- `builders/*` — `TableHandlers`, `ColumnHandlers`, `IndexHandlers`, `FkHandlers`,
  `UniqueConstraintHandlers`, `SequencesSqlBuilder`, `SeedDiff`.
- `SqlQuoter` — injection-safe SQL quoter (Strategy + Factory + Facade). `q()` for identifiers,
  `formatValue()` → `literal()` for values. ESLint rule enforces no raw string interpolation in
  SQL.
- `SchemaSnapshot`, `ModelSnapshot` — immutable snapshot types.
- Model snapshot: `ModelSnapshotBuilder` — thin coordinator over ordered `EntityExpander`
  strategies (`src/snapshot/expanders/`). Single `ColumnMapper` shared by all expanders.
- Schema snapshot: `SchemaSnapshotBuilder`.
- `script/idempotent-emitter` — idempotent SQL script output.
- `bundle/build-bundle` — uses `esbuild` to bundle migrations.

**Scaffolding subpath** (`./scaffold`):
- `scaffoldDbContext` — reverse-engineer existing database into entity classes.
- `name-normalizer`.

**Dependencies**: `@ts-querable/core`, `@ts-querable/metadata`, `@ts-querable/types`, `esbuild`.

---

### 5.7 Metadata

#### `@ts-querable/metadata`

> Entity metadata model, decorator metadata storage, the metadata registry, value
> converters/comparers, and compiled-model hydration.

**Key exports**:

- Metadata descriptors: `EntityMetadata`, `Column`, `PrimaryKey`, `Relationships`,
  `ComputedColumn`, `ViewMetadata`, `DatabaseFunction`, `CachePolicy`.
- `MetadataRegistry` (implements `MetadataSource` + `MetadataSink` ports from `@ts-querable/types`),
  `createMetadataRegistry()`.
- `MetadataStorage`, `PendingMetadataCollector`, `SequenceRegistry`.
- Value conversion: `ValueConverter`, `ValueComparer`, built-ins (`BoolToZeroOneConverter`,
  `DateOnlyToStringConverter`, `EnumToNumberConverter`, `EnumToStringConverter`).
- Property access: `PropertyAccessMode`, `PropertyAccessor`.
- Compiled models: `CompiledModel`, `compiled-model-hydrator`.
- `stored-procedure-mapping`.
- Reflection helpers: `reflectGetOwnMetadata`, `resolveEntityRef`, `ValidIf`.

**Internal architecture** (post-refactor):

`MetadataRegistry` is decomposed into 7 facet stores, each responsible for one concern (entities,
columns, relationships, indexes, sequences, …). All mutations go through
`EntityMetadataState.mutate()` — a Template Method pattern ensuring validation on every write.

**MetadataSource / MetadataSink ports** (defined in `@ts-querable/types`):

`core` and `orm` depend on these ports, not on `MetadataStorage` directly. This enforces DIP: the
loading layer never imports `MetadataStorage` — it receives an injected `MetadataSource`.
`EmptyMetadataSource` is the Null Object for contexts without entities.

**Dependencies**: `@ts-querable/types`.

---

### 5.8 Concurrency & Resilience

#### `@ts-querable/concurrency`

> Execution strategy and retry-policy primitives for resilient database access.

**Key exports**:

- `ExecutionStrategy` — wraps operations with retry/backoff. Fields: `maxRetries`, `budget`
  (total budget in ms), injected `Sleeper` (testable). Driven by `RetryPolicy`.
- `RetryPolicies` — ready-made policies: fixed, exponential backoff, etc. Implements `RetryPolicy`
  from `@ts-querable/types`.

`@ts-querable/core` depends on `@ts-querable/concurrency` (not the reverse). The `instanceof` check for
`RetryPolicy` works cross-package because the concrete classes live in `concurrency`.

**Dependencies**: `@ts-querable/types`.

---

### 5.9 Caching

#### `@ts-querable/cache`

- `CachePolicy` — TTL / invalidation / keying policy.
- `EntityCache` — entity-cache contract that adapters implement.

**Dependencies**: `@ts-querable/types`, `@ts-querable/metrics-safe`. Peer: `@ts-querable/core`.

#### `@ts-querable/cache-redis`

Redis-backed implementations:
- `RedisSqlCacheAdapter` — caches SQL query results.
- `RedisCountCacheAdapter` — caches `count()` results.
- `RedisEntityCacheAdapter` — caches materialized entities.

Works with `ioredis` or `redis` (peer).

#### `@ts-querable/cache-memcached`

Memcached-backed implementations:
- `MemcachedSqlCacheAdapter`, `MemcachedCountCacheAdapter`, `MemcachedEntityCacheAdapter`.

Uses `memjs` (peer).

---

### 5.10 Observability & Logging

#### `@ts-querable/metrics-safe`

> Safe, dependency-free helpers for optional metrics and memory profiling.

- `safeInvoke(logger, method, ...args)` — generic, type-safe guard over `SqlLogger`. Never
  propagates an error. Type-checks method name and arguments.
- `SafeSqlLogger` — Decorator that wraps any `SqlLogger` so every method is guarded.
- `safeCache`, `safeCacheSize`, `safeCacheEvicted` — guarded convenience functions for cache
  telemetry.
- `warnIfLoggerDebug` — opt-in debug diagnostics.
- `MemoryProfiler` — lightweight memory sampler with `MemorySample`, `MemoryProfilerOptions`.

Subpath `/memory` re-exported from root for back-compat.

**Dependencies**: none.

#### `@ts-querable/telemetry`

- `TelemetryProvider` — integration surface.
- `diagnostic-emitter`, `event-ids`.
- `parameter-masker` — redacts sensitive values from logged SQL.
- `tag-span-attributes` (`parseTagsFromSql`).
- `warning-router`.

**Dependencies**: `@ts-querable/types`.

#### `@ts-querable/open-telemetry-sql-logger`

- `OpenTelemetrySqlLogger` — `SqlLogger` implementation emitting OpenTelemetry spans for SQL
  execution.

**Dependencies**: `@ts-querable/types`. Peer: `@ts-querable/core`, OpenTelemetry SDK.

#### `@ts-querable/prometheus-sql-logger`

- `PrometheusSqlLogger` — `SqlLogger` implementation recording Prometheus counters/histograms.

> ⚠️ Be careful with metric label cardinality. Prefer bounded labels (operation type, table name
> from metadata, status) — not raw SQL.

**Dependencies**: `@ts-querable/types`. Peer: `@ts-querable/core`, Prometheus client.

#### `@ts-querable/composite-sql-logger`

- `CompositeSqlLogger` — forwards each `SqlLogger` event to all children.
- `CompositeSqlLoggerFactory` — `SqlLoggerFactory` that builds composites.

Usage: send SQL diagnostics to console + Prometheus + OpenTelemetry simultaneously.

**Dependencies**: `@ts-querable/types`. Peer: `@ts-querable/core`.

---

### 5.11 Plugins

All plugins implement `OrmMiddleware` from `@ts-querable/types`.

> ⚠️ **Status**: The `OrmMiddleware` lifecycle hooks are **not currently invoked** by the runtime.
> These plugins should not be used in production until the middleware dispatch is wired.

#### `@ts-querable/plugin-audit`

- `AuditMiddleware` — captures entity changes (create/update/delete) for audit trails.

#### `@ts-querable/plugin-soft-delete`

- `SoftDeleteMiddleware` — converts `DELETE` operations into `UPDATE`s of a soft-delete column;
  excludes soft-deleted rows from queries.

> ⚠️ **Note**: soft-delete is also natively supported in `@ts-querable/orm`. This plugin is a
> duplicate path.

#### `@ts-querable/plugin-multi-tenant`

- `MultiTenantMiddleware` — resolves the current tenant and applies a tenant filter.

> ⚠️ **Security**: Current filter construction has a SQL-injection vulnerability. Do not use in
> production.

---

### 5.12 CLI

#### `@ts-querable/cli`

> The `ts-querable` binary for development and CI.

**Commands**:

| Command | Purpose |
|---|---|
| `init` | Scaffold initial ts-querable config |
| `generate:migration` | Generate migration from model changes |
| `generate:entity` / `generate:entities` | Generate entity classes |
| `migrations:status` / `:validate` / `:dry-run` | Inspect/validate pending migrations |
| `migrations:rollback` | Roll back applied migrations |
| `migrations:script` / `:bundle` | Emit idempotent SQL script / bundled migrations |
| `schema:diff` / `:apply` / `:export` / `:validate` | Schema diffing and application |
| `scaffold` | DB-first scaffolding of `DbContext` |
| `dbcontext:optimize` | Emit a compiled model (AOT) |
| `seed` | Run data seeding |
| `metrics:serve` | Serve a metrics endpoint |

**Architecture**: ports & adapters pattern.
- Ports: `FileSystem`, `Logger`, `ProviderFactory`.
- Adapters: `NodeFs`, `ConsoleLogger`, `EnvProviderFactory`.
- Commands implement a common `Command` interface.
- `CommandRegistry` wires commands.
- Generators in `generators/`.
- `bootstrap/StubDatabaseProvider` — used for AOT `dbcontext:optimize` without a real DB.

**Dependencies**: `@ts-querable/core`, `@ts-querable/metadata`, `@ts-querable/types`, `@ts-querable/migrations`.

---

### 5.13 Integrations

#### `@ts-querable/integration-nestjs`

> **Status: placeholder** (`src/index.ts` only, `2.0.0-alpha.1`).

Intended scope (not yet implemented):
- `DbContextModule` for registering contexts with NestJS DI.
- Request-scoped context / unit-of-work integration.
- Lifecycle hooks for connection management.

#### `@ts-querable/pagination`

> **Status: placeholder** (`src/index.ts` only, `2.0.0-alpha.1`).

Pagination is already implemented inside `@ts-querable/query` (`PaginationBuilder`). This package's
role (standalone keyset/cursor helpers) needs to be decided.

---

### 5.14 Testing Infrastructure

#### `@ts-querable/testkits`

> Contract- and integration-test utilities.

- `TestProvider` — in-memory `DatabaseProvider` with a regex SQL engine; used by unit tests.
- `MockProvider` — configurable mock provider.
- `DatabaseHarness` — spins up real-DB contract tests (used with `testcontainers`).
- `EntityBuilder` — fluent test-entity construction.
- `TestEntities` — shared fixture entities.
- `SqlSnapshotMatcher` — assert generated SQL via Jest snapshots.

#### `@ts-querable/integration-tests`

Real-database integration tests using `testcontainers`. Covers query behavior, migrations,
providers, and ORM features against live Postgres/MySQL/MSSQL instances.

#### `@ts-querable/e2e-tests`

End-to-end tests that exercise the full application stack.

#### `@ts-querable/examples`

Usage examples compiled with `tspc` (ts-patch). Demonstrates the transformer + key ORM features.

---

### 5.15 Shared Config Packages

#### `@ts-querable/eslint-config`

Shared ESLint flat config (ESLint 9) for all packages. Includes:
- `typescript-eslint` rules.
- `eslint-plugin-simple-import-sort`.
- `eslint-plugin-unused-imports`.
- `eslint-plugin-prettier`.
- `overrides` option for per-package ESLint config files (`eslint.config.mjs`).
- Custom rule: `no-raw-quote` (enforces `SqlQuoter` usage in migrations, preventing SQL injection
  via raw string interpolation).

#### `@ts-querable/jest-config`

Shared Jest configuration. Includes `ts-jest` transformer setup, module name mapper for
`./internal` subpaths, path aliases, test-d (tsd) support.

#### `@ts-querable/typescript-config`

Shared `tsconfig` base files:
- `base.json` — `strict: true`, `ES2022.Error` in `lib` (for error `cause`), decorator metadata.
- `esm.json` — ESM output.
- `jest.json` — test configuration.

---

## 6. Feature Catalog (EF Core Parity Roadmap)

The full roadmap lives in `project-documents/tasks/dev-plans/README.md`. Summary:

### P0 — Foundation (15 tasks)

| # | Feature | EF Core API | Status |
|---|---|---|---|
| P0-01 | Fluent API — ModelBuilder | `OnModelCreating`, `ModelBuilder`, `EntityTypeBuilder<T>` | ✅ |
| P0-02 | AsNoTracking / AsTracking | `AsNoTracking`, `QueryTrackingBehavior` | ✅ |
| P0-03 | FromSql / FromSqlInterpolated | `FromSql`, `FromSqlRaw`, `SqlQuery`, `ExecuteSqlInterpolated` | ✅ |
| P0-04 | ExecuteUpdate / ExecuteDelete | `ExecuteUpdate(SetProperty...)`, `ExecuteDelete` | ✅ |
| P0-05 | Value converters | `HasConversion`, `ValueConverter<T,U>`, `ValueComparer` | ✅ |
| P0-06 | Owned entity types | `OwnsOne`, `OwnsMany`, table splitting, `ToJson()` | ✅ |
| P0-07 | Inheritance — TPH/TPT/TPC | `HasDiscriminator`, `UseTptMappingStrategy`, `UseTpcMappingStrategy` | ✅ |
| P0-08 | Many-to-many skip navigations | `HasMany().WithMany()`, `UsingEntity<T>` | ✅ |
| P0-09 | Cascade delete behaviors | `OnDelete(DeleteBehavior.*)` | ✅ |
| P0-10 | Concurrency tokens / RowVersion | `IsConcurrencyToken`, `IsRowVersion`, `DbUpdateConcurrencyException` | ✅ |
| P0-11 | Global query filters | `HasQueryFilter`, `IgnoreQueryFilters` | ✅ |
| P0-12 | Interceptors | `IDbCommandInterceptor`, `IDbConnectionInterceptor`, `ISaveChangesInterceptor`, `IMaterializationInterceptor` | ✅ |
| P0-13 | HasData seeding | `modelBuilder.Entity<T>().HasData(...)` | ✅ |
| P0-14 | Computed / default / check | `HasDefaultValueSql`, `HasComputedColumnSql`, `HasCheckConstraint`, `HasComment` | ✅ |
| P0-15 | JSON columns | `OwnsOne(..., b => b.ToJson())`, LINQ over JSON paths | ✅ |

### P1 — Important parity (17 tasks, partial)

| # | Feature | Status |
|---|---|---|
| P1-16 | Shadow properties | ✅ |
| P1-17 | Complex types (EF8) | ✅ |
| P1-18 | AsSplitQuery / AsSingleQuery | in progress |
| P1-19 | Filtered Include | in progress |
| P1-20 | Compiled queries (`EF.CompileQuery`) | in progress |
| P1-21 | Sequences / HiLo | ✅ |
| P1-22 | EF.Functions / DbFunctions | ✅ |
| P1-23 | Transaction savepoints + retry | in progress |
| P1-24 | Primitive collections | in progress |
| P1-25 | Table entity splitting | in progress |
| P1-26 | Views / keyless entities | ✅ |
| P1-27 | Async streaming enumerable | in progress |
| P1-28 | TrackGraph / DetectChanges | ✅ |
| P1-29 | DbSet.Local / Find / FindAsync | ✅ |
| P1-30 | Value generators / sentinel | in progress |
| P1-31 | Alternate keys / indexes | ✅ |
| P1-32 | Backing fields / PropertyAccessMode | ✅ |

### P2 — Advanced features (partial)

| # | Feature | Status |
|---|---|---|
| P2-33 | Stored procedure mapping | ✅ |
| P2-34 | Spatial types (geometry, WKB/WKT) | ✅ |
| P2-35 | HierarchyId | ✅ |
| P2-36 | Temporal queries | in progress |
| P2-37 | Cosmos provider | planned |
| P2-38 | SQLite provider | planned |
| P2-39 | In-memory provider | planned |
| P2-40 | DbContext pooling / factory | in progress |
| P2-41 | Query tags + call site | in progress |
| P2-42 | Migration bundles / idempotent | ✅ |
| P2-43 | DB-first scaffolding | ✅ |
| P2-44 | Compiled models / AOT | ✅ (partial) |
| P2-45 | Logging / diagnostics | in progress |
| P2-46 | Batching / MaxBatchSize | ✅ |
| P2-47 | Read replica / multi-tenancy | planned |
| P2-48 | Vector search | planned |

### RF — Infrastructure refactors

| # | Title | Status |
|---|---|---|
| RF-01 | Transformer Refactor (Clean Architecture) | ✅ (partial — needs ts-morph migration) |

---

## 7. Error Handling Architecture

All errors thrown by production/library code **must** inherit from the project's base error
hierarchy. Never throw `new Error(...)` in shipped code.

### Base hierarchy (in `@ts-querable/types/errors.ts`)

```
OrmError (abstract root)
  ├── DatabaseError                  — generic database failures
  ├── OptimisticConcurrencyError     — concurrency token mismatch
  ├── UniqueConstraintError          — unique constraint violation
  ├── ForeignKeyConstraintError      — FK constraint violation
  ├── ValidationError                — entity validation failure
  ├── TemporalNotSupportedError      — temporal query on non-temporal table
  ├── UnsupportedOperationError      — dialect/feature not supported
  ├── MetadataError                  — metadata registry failures
  ├── DecoratorUsageError            — misuse of decorators
  ├── BatchConfigurationError        — invalid batch setup
  ├── InvalidIncludeError            — invalid include path
  ├── OperationAbortedError          — operation cancelled via AbortSignal
  ├── QueryFilterCompilationError    — global filter fail-closed (security)
  ├── FallbackExhaustedError         — all fallbacks exhausted (aggregate)
  ├── SelectorExtractionError        — key selector extraction failure
  ├── EntityNotFoundError            — entity not found in upsert context
  ├── OwnedEntityHydrationError      — JSON hydration failure
  ├── RelationshipLoadError          — relationship loading failure
  ├── InvalidIdentifierError         — SQL injection guard in junction queries
  ├── MigrationApplyError            — migration apply failure (static `.from()`)
  ├── MigrationRollbackError         — migration rollback failure (static `.from()`)
  ├── SnapshotSerializationError     — snapshot serialization failure
  ├── SnapshotValidationError        — snapshot validation failure
  ├── BundleBuildError               — bundle build failure
  └── ProviderRequiredError          — provider not configured
```

### `OrmErrorCode`

Every concrete `OrmError` carries a stable, machine-readable `code` (a literal from
`OrmErrorCode`). Consumers use `e instanceof OrmError` and `e.code` — never string-match messages.

### Rules

1. **Inherit, don't reinvent.** Reuse the closest existing `OrmError` subclass. If none fits, add
   a new subclass in `@ts-querable/types/errors.ts` with a new stable `OrmErrorCode` entry.
2. **Always chain the cause.** When wrapping a lower-level failure, pass it via `{ cause }`.
3. **No silent swallows.** Never use a bare `catch` to drop an error on a correctness-critical
   path. Either handle it explicitly or wrap-and-rethrow as a typed `OrmError`. Legitimate
   capability probes are single, documented checks.
4. **Discriminate by type / code, not strings.** Keep messages user-safe (no secrets/PII).
5. **Changeset impact**: adding a new error class / code is `minor` to `@ts-querable/types`; changing
   or removing one is `major`.

---

## 8. Versioning & Release Workflow

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and
changelog generation. **Versions are bumped locally before opening a PR** — there is no automated
"Version Packages" PR from CI.

### When to create a changeset

Create a changeset for any PR that:
- Adds, removes, or changes a **public API** (exported types, function signatures, identifiers).
- Changes **runtime behavior** that consumers would observe.
- Fixes a **bug** in a versioned package.
- Introduces a **breaking change** (always `major` + explicit migration docs).
- Makes a **performance or behavioral improvement** worth communicating.

Do **not** create a changeset for:
- Changes only in `@ts-querable/e2e-tests`, `@ts-querable/integration-tests`, `@ts-querable/examples`.
- `@ts-querable/eslint-config`, `@ts-querable/jest-config`, `@ts-querable/typescript-config`.
- Documentation-only edits with no API change.
- CI/CD workflow changes.

### Change type selection

| Type | When |
|---|---|
| `patch` | Bug fix, internal refactor with no API surface change |
| `minor` | New exported API that is backward compatible |
| `major` | Breaking change — removal, rename, or incompatible signature change |

When in doubt, choose `patch`.

### Mandatory local versioning workflow

**Before opening a PR**, for every PR that touches versioned package source:

```bash
# 1. Create a changeset
pnpm changeset

# 2. Consume the changeset: bumps package.json versions + writes CHANGELOG entries
pnpm changeset version

# 3. Commit the version bumps
git add packages/*/package.json packages/*/CHANGELOG.md .changeset
git commit -m "chore: version packages"
```

The PR branch must contain bumped `package.json` files and updated `CHANGELOG.md` entries.
No unconsumed `.changeset/*.md` files should remain in the branch.

CI enforces:
- If versioned package sources changed → at least one `package.json` version must be bumped.
- Unconsumed changeset files are not allowed.

### Release flow

1. Developer runs `pnpm changeset && pnpm changeset version` locally.
2. PR with source changes + bumped versions merges to `main`.
3. Release workflow publishes packages whose `package.json` version > npm registry version.

---

## 9. Engineering Rules & Conventions

### Priority order

1. Type safety
2. API stability
3. Fluent API ergonomics
4. Architectural consistency
5. Monorepo integrity
6. Backward compatibility
7. Build and test reliability

### TypeScript API design

- Preserve type inference wherever possible.
- Avoid widening generic types.
- Avoid unnecessary overloads.
- Never introduce `any` into public APIs. Prefer `unknown`.
- Prefer strongly typed builder patterns.
- Preserve fluent API composability and chainability.
- Maintain generic propagation across chained calls.
- Avoid breaking conditional type behavior, distributive type regressions, inference degradation.

### Comments policy

- Default: **no comments**.
- Only add a comment when the WHY is non-obvious: a hidden constraint, a subtle invariant, a
  workaround for a specific bug, behavior that would surprise a reader.
- Never document WHAT the code does (well-named identifiers do that).
- Never reference the current task, issue, or callers in comments.
- No multi-paragraph docstrings. One short line max.
- All source file comments must be in **English**.

### Code style

- Prefer explicitness over implicit behavior.
- Prefer maintainability over cleverness.
- Prefer deterministic behavior over magic abstractions.
- Keep runtime behavior aligned with type-level behavior.
- Avoid hidden side effects.
- Keep naming consistent across packages.
- Keep APIs cohesive.
- Minimize technical debt introduction.
- Do not perform unrelated cleanup during feature implementation.
- Three similar lines is better than a premature abstraction.
- No half-finished implementations.
- No backwards-compatibility hacks (renaming unused `_vars`, re-exporting types for removed code,
  `// removed` comments).

### Breaking changes

Any breaking change must:
- Be explicitly documented.
- Include migration reasoning.
- Include affected APIs/packages.
- Be validated across the monorepo.

### Monorepo and package boundary rules

- Do not introduce circular dependencies.
- Do not bypass package boundaries.
- Do not import package internals unless explicitly allowed.
- Public APIs must go through package entrypoints.
- Shared abstractions belong in shared/core packages.
- Do not duplicate shared logic across packages.

When changing shared APIs:
1. Inspect all downstream usages.
2. Verify type compatibility.
3. Verify runtime compatibility.
4. Verify tests across affected packages.
5. Verify exported API surfaces.

### Testing rules

**Required**:
- Unit tests for all new behavior.
- Integration tests for cross-package behavior.
- Regression tests for bug fixes.
- Type-level tests (`*.type.test.ts` via ts-jest + `tsd`) for generic/type inference behavior.

**Forbidden**:
- Deleting failing tests without justification.
- Weakening assertions to force passing results.
- Skipping tests unless explicitly approved.
- Ignoring TypeScript errors.
- Running integration/e2e tests in background (they hang — the user kills them manually).

### PR rules

Before creating a PR:
1. Ensure all validations pass.
2. Ensure the monorepo builds successfully.
3. Ensure documentation is updated.
4. Ensure architectural checks pass.
5. Ensure no unrelated files were modified.

PR description must include:
- Implemented functionality.
- Modified packages/files.
- Architectural impact.
- Executed validations.
- Final validation status.

---

## 10. Development Workflow (CLAUDE.md)

The `CLAUDE.md` file at the repo root defines the agent's engineering contract. Key sections:

### Work Modes

**Audit Mode**: Analyze only, no production code changes. Findings go into `issues-v4/` as
separate Markdown files. Use tooling output as evidence.

**Implementation Mode**: Read entire task → inspect related APIs → preserve architectural
boundaries → prefer minimal precise changes → keep public APIs backward compatible.

**Refactor Mode**: Create a short plan → verify all affected packages → verify public API
compatibility → verify type inference preservation → avoid hidden breaking changes.

### Standard Implementation Workflow

**Before coding**:
1. Read the task/documentation completely.
2. Inspect related public APIs.
3. Inspect package boundaries.
4. Use Serena MCP to inspect symbols, references, and implementations.
5. Use Context7 MCP for external documentation.
6. Create a short implementation plan.
7. Only then modify code.

**After coding**:
1. Run all required validations.
2. Fix all failures.
3. Re-run the full validation suite.
4. Verify no architectural regressions.
5. Update documentation.
6. Update Serena MCP memory.

### Task and documentation rules

Task plans live in `project-documents/tasks/dev-plans/`. After completing a task:
- Mark the task as completed in all relevant sections of `README.md`.
- Update section `7. Implementation order`.
- Synchronize documentation with implementation status.

### Mandatory tooling

| Tool | Purpose |
|---|---|
| **Serena MCP** | Primary code navigation: find symbols, inspect references/implementations/inheritance, cross-package dependencies, generic type propagation, fluent API chains |
| **Context7 MCP** | External library docs, TypeScript language behavior, ORM APIs, tooling docs. Never rely on training memory for external APIs |

### Serena MCP memory

After completing a task, update Serena MCP knowledge/memory with:
- New architectural decisions.
- Public API changes.
- Package boundary changes.
- Important implementation details.
- Typing strategy changes.
- Validation outcomes.
- Known limitations or follow-up concerns.

---

## 11. Task Template (TASK_TEMPLATE.md)

Every implementation task in `project-documents/tasks/dev-plans/` follows this 13-step template:

| Step | Action |
|---|---|
| 0 | Serena MCP setup (activate project) |
| 1 | Branch Setup — pull latest `main`, create working branch |
| 2 | Planning & Architecture — invoke `/engineering:architecture`, `/engineering:system-design`, `/clean-architecture`; inspect APIs via Serena; produce implementation plan; wait for approval |
| 3 | Implementation — invoke `/typescript-expert`, `/typescript-best-practices`, `/typescript-advanced-types-v2`, `/ts-library`, `/turborepo`, `/error-handling-patterns`, `/code-refactoring-refactor-clean-v2`, `/sql-optimization-patterns` |
| 4 | Testing — invoke `/engineering:testing-strategy`; write unit + integration + e2e + type-level tests |
| 5 | Security Review — invoke `/security-review`; check injection, unsafe coercions, input validation |
| 6 | Validation — run full validation suite; fix all failures; repeat until zero errors |
| 7 | Self-Review — invoke `/code-review`, `/engineering:code-review`, `/simplify` |
| 8 | Verify — invoke `/verify`; confirm end-to-end behavior |
| 9 | Tech Debt Check — invoke `/engineering:tech-debt`; document any shortcuts |
| 10 | Documentation — invoke `/engineering:documentation`; update README.md task status |
| 11 | Serena Memory Update — record architectural decisions, API changes, outcomes |
| 12 | Changeset — `pnpm changeset` per §14 rules |
| 13 | Commit + PR — invoke `/engineering:deploy-checklist`; create PR with full description |

**Completion criteria** (all must be true):
- [ ] All functionality fully implemented
- [ ] Clean Architecture + SOLID respected
- [ ] All monorepo checks pass with zero errors
- [ ] Monorepo builds successfully
- [ ] Security review passed
- [ ] Adequate automated test coverage (unit + integration + type-level)
- [ ] README.md updated
- [ ] Tech debt documented
- [ ] Serena MCP memory updated
- [ ] Changes committed with changeset file
- [ ] PR created with complete description

---

## 12. Available AI Skills

The following skills are available for use during development. Match skills to the task type.

### Planning & architecture

| Skill | Use it for |
|---|---|
| `/engineering:architecture` | ADRs; choosing between technologies; documenting design decisions with trade-offs |
| `/engineering:system-design` | Designing services/APIs, data models, module/package boundaries before coding |
| `/clean-architecture` | Enforcing layering, inward dependency direction, package boundaries, SOLID |

### TypeScript implementation

| Skill | Use it for |
|---|---|
| `/typescript-expert` | Type-level programming, monorepo management, migrations, tooling, performance. **Primary TS skill** |
| `/typescript-best-practices` | Type-first design, making illegal states unrepresentable, exhaustive handling, runtime validation |
| `/typescript-advanced-types-v2` | Generics, conditional/mapped/template-literal types, utility types for builders & fluent APIs |
| `/typescript` | `tsc` performance, `tsconfig` configuration, resolving TS errors, module organization |
| `/ts-library` | Library authoring: package `exports`, build tooling, public API design, type-inference preservation |
| `/turborepo` | `turbo.json`, task pipelines, caching, `--filter`/`--affected`, cross-package wiring |
| `/error-handling-patterns` | Designing exception hierarchies, Result/Either types, retry/circuit-breaker, error boundaries |
| `/code-refactoring-refactor-clean-v2` | Clean-code + SOLID refactoring (Extract Class, Template Method, guard clauses, DRY) |
| `/sql-optimization-patterns` | Query optimization, indexing, EXPLAIN — for query-generation / DDL / DML tasks only |

### Testing, review & verification

| Skill | Use it for |
|---|---|
| `/engineering:testing-strategy` | Designing the test plan & coverage (unit / integration / e2e / type-level) |
| `/code-review` | Reviewing the diff for correctness bugs, type-inference regressions, API/boundary breaks |
| `/engineering:code-review` | Reviewing architectural consistency, SOLID adherence, design-pattern correctness |
| `/simplify` | Removing over-engineering and duplication; reuse/efficiency cleanups (quality, not bug-hunting) |
| `/security-review` | Auditing changes for injection, unsafe coercions / `any` leaks, input-validation gaps |
| `/verify` | Running the app/feature end-to-end to confirm behavior — not just type/unit pass |
| `/engineering:debug` | Structured reproduce → isolate → diagnose → fix when behavior diverges from expected |

### Process, docs & release

| Skill | Use it for |
|---|---|
| `/engineering:tech-debt` | Identifying, categorizing, and documenting tech debt / follow-ups |
| `/engineering:documentation` | Writing/maintaining READMEs, task docs, runbooks, API docs |
| `/engineering:deploy-checklist` | Pre-PR / pre-deploy verification checklist |

**Rule of thumb**: Match skills to the task. Hygiene/tooling tasks need few (review + docs);
architecture tasks pull in planning + `/clean-architecture` + TS-design skills; refactors lead with
`/code-refactoring-refactor-clean-v2`; anything emitting SQL/DDL adds `/sql-optimization-patterns`
and `/security-review`.

---

## 13. Technologies Used

### Core runtime dependencies

| Technology | Version | Purpose |
|---|---|---|
| **TypeScript** | `^5.4.5` | Language |
| **reflect-metadata** | `^0.2.2` | Decorator metadata for entity mapping |
| **ts-patch** | `^3.3.0` | TypeScript compiler patching (enables transformer plugins) |
| **ts-morph** | (target) | High-level TypeScript AST manipulation (transformer migration target) |

### Database drivers (peer dependencies)

| Driver | Database |
|---|---|
| `pg` | PostgreSQL |
| `mysql2` | MySQL |
| `mssql` / `tedious` | Microsoft SQL Server |

### Caching drivers (peer dependencies)

| Driver | Cache |
|---|---|
| `ioredis` or `redis` | Redis |
| `memjs` | Memcached |

### Build & monorepo tooling

| Tool | Version | Purpose |
|---|---|---|
| **pnpm** | `10.18.3` | Package manager + workspaces |
| **Turborepo** | `^2.5.8` | Monorepo build system, task pipeline, caching |
| **esbuild** | (via migrations) | Migration bundle building |
| **typedoc** | `^0.28.x` | API documentation generation |

### Testing tools

| Tool | Version | Purpose |
|---|---|---|
| **Jest** | `^29.7.0` | Test runner |
| **ts-jest** | `^29.4.5` | TypeScript support in Jest |
| **tsd** | `^0.30.7` | Type-level tests |
| **testcontainers** | `^10.9.0` | Real database containers for integration tests |
| **fast-check** | `^4.3.0` | Property-based testing |

### Code quality tools

| Tool | Version | Purpose |
|---|---|---|
| **ESLint** | `^9.x` | Linting (flat config) |
| **typescript-eslint** | `^8.x` | TS-specific lint rules |
| **Prettier** | `^3.x` | Code formatting |
| **Husky** | `^9.x` | Git hooks |
| **dependency-cruiser** | `^17.x` | Architectural dependency rules enforcement |
| **madge** | `^8.x` | Circular dependency detection |
| **ts-prune** | `^0.10.x` | Dead export detection |
| **Changesets** | `^2.31.0` | Versioning and changelogs |
| **commitlint** | `^19.x` | Conventional commit enforcement |

### Observability

| Technology | Purpose |
|---|---|
| **OpenTelemetry SDK** | Distributed tracing (`@ts-querable/open-telemetry-sql-logger`) |
| **Prometheus client** | Metrics scraping (`@ts-querable/prometheus-sql-logger`) |

### Frameworks (integrations)

| Framework | Package |
|---|---|
| **NestJS** | `@ts-querable/integration-nestjs` (stub, not yet implemented) |

---

## 14. Validation Commands

Run the following commands when working on implementation tasks. **A task is NOT complete until all
checks pass with zero errors.**

```bash
pnpm typecheck          # TypeScript type checking across all packages
pnpm lint               # ESLint across all packages
pnpm tests:unit         # Unit tests
pnpm test:integration   # Integration tests (requires running databases)
pnpm tests:e2e          # End-to-end tests
pnpm build              # Build all packages
pnpm arch:deps          # dependency-cruiser architectural rule enforcement
pnpm arch:cycles        # madge circular dependency detection
pnpm arch:dead          # ts-prune dead export detection
```

> **Never bypass failing checks.**
> **Never weaken tests simply to make them pass.**
> **Never run integration/e2e tests in the background** — they hang and must be killed manually.

If any validation fails:
1. Find the root cause.
2. Fix the issue.
3. Re-run the full validation suite.
4. Continue until all checks pass.

Additional architecture commands:

```bash
pnpm arch:deps:json     # Dependency graph as JSON
pnpm arch:deps:dot      # Dependency graph as Graphviz DOT
pnpm arch:deps:graph    # Dependency graph as SVG
pnpm arch:graph         # Module graph via madge as SVG
pnpm arch:phantom       # Phantom dependency check
pnpm arch:audit         # All architecture checks combined
pnpm test-d             # Type-level tests (tsd)
pnpm format:check       # Prettier formatting check
```

---

## 15. Architecture Analysis Commands

Use these tools to verify architectural decisions:

| Command | Tool | Purpose |
|---|---|---|
| `pnpm arch:deps` | dependency-cruiser | Enforce architectural rules (no upward deps, no circular, allowed boundaries) |
| `pnpm arch:cycles` | madge | Detect circular imports (TS source) |
| `pnpm arch:dead` | ts-prune | Find exported symbols never consumed |
| `pnpm arch:phantom` | custom script | Find phantom dependencies (used but not declared in `package.json`) |

Configuration files:
- `.dependency-cruiser.cjs` — dependency-cruiser rule set.
- `ts-prune-ignore.txt` — ts-prune allowlist (intentionally exported-but-not-used symbols).

---

## 16. Dependency Graph Rules

The following dependencies are **forbidden**:

- Circular imports anywhere in the package graph.
- `@ts-querable/types` depending on any other `@ts-querable/*` package.
- `@ts-querable/ast` depending on any other `@ts-querable/*` package (only `types`).
- `@ts-querable/sql-visitor` depending on `core`, `metadata`, `query`, `orm`, `migrations`.
- Dialect packages depending on `query`, `orm`, `migrations`.
- Provider packages depending on `query`, `orm`, `migrations`.
- `@ts-querable/core` depending on `query`, `orm`, `migrations`.
- Any package importing internals of another package (only through entrypoints or `./internal`
  subpath where explicitly provided).

The dependency ordering (from most fundamental to most derived) is:

```
types → ast → sql-visitor → metadata → core → concurrency
                                            ↓
                                         query
                                            ↓
                            (dialects + providers) → migrations → orm → cli
```

Plugins (`plugin-*`), logger packages, and cache adapters are leaves — they depend on `types` and
`core` but nothing depends on them (except optionally `orm` for first-party plugins).

---

*End of SPEC.md*
