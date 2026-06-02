# @ts-linq/types

> Pure type definitions and interfaces for ts-linq — **zero runtime dependencies**.

This package is the canonical home for the shared contracts of the ts-linq ORM: SQL primitives,
query clause shapes, dialect/provider configuration, logging and telemetry info objects, the
`OrmMiddleware` lifecycle contract, the `Result`/fallback types, and the cross-package error
hierarchy. Every other package depends on it; it depends on nothing.

## Installation

```bash
pnpm add @ts-linq/types
```

## What lives here

The package is organized into cohesive concern modules under `src/`. The public entrypoint
`src/index.ts` is a thin re-export barrel over all modules — consumers always import from
`@ts-linq/types`.

| Module | Concern | Key exports |
|---|---|---|
| `sql.ts` | SQL primitives & query options | `SqlParameter`, `WhereClause`, `QueryOptions`, `FilteredIncludeSpec` |
| `logging.ts` | Logger interfaces & event DTOs | `Logger`, `SqlLogger`, `SqlLoggerFactory`, `QueryStartInfo`, `QueryEndInfo`, `CircuitState` |
| `dialect.ts` | SQL dialect contract & DML result types | `SqlDialect`, `SqlWithParams`, `BatchInsertResult`, `SqlDialect` |
| `middleware.ts` | Middleware hooks & retry policy | `OrmMiddleware`, `RetryPolicy`, `ExecutionStrategyOptions`, `BeforeExecuteInfo` |
| `config.ts` | Provider configuration | `BaseProviderConfig`, `PostgresConfig`, `MySqlConfig`, `MssqlConfig`, `AuditOptions` |
| `query-filters.ts` | Global & named query filters | `GlobalFilter`, `QueryFilterMetadata` |
| `results.ts` | Result type & fallback | `Result<T,E>`, `FallbackPolicy`, `QueryFallback` |
| `cache.ts` | Cache interfaces & performance | `SqlCache`, `TemplateSqlCache`, `PerformanceOptions`, `EntityCacheLike` |
| `value-conversion.ts` | Value converters, generators & sequences | `ValueConverterLike`, `ValueComparerLike`, `ValueGenerator`, `SequenceMetadata` |
| `metadata.ts` | ORM metadata model | `EntityMetadata`, `ColumnMetadata`, `RelationshipMetadata`, `JsonShape` |
| `stored-procedure.ts` | Stored procedure mapping (P2-33) | `SpCallSyntax`, `StoredProcedureConfig`, `SpParameterMapping` |
| `tracking.ts` | Change tracking primitives | `TrackedEntity` |
| `enums.ts` | Runtime enums (the package's value-emitting enums) | `EntityState`, `LoadingStrategy`, `ValueGeneratedPolicy`, `DeleteBehavior`, `StorageStrategy`, `InheritanceStrategy`, `QuerySplittingBehavior` |
| `runtime.ts` | Runtime helpers (the only behaviour-carrying module) | `ok()`, `err()`, `isTemplateSqlCache()` |
| `spatial-hierarchy.ts` | Translator interfaces (P2-34/35) | `SpatialTranslator`, `HierarchyIdTranslator` |
| `diagnostics.ts` | Diagnostic configuration (P2-45) | `LogLevel`, `WarningBehavior`, `DiagnosticConfig` |
| `scaffolding.ts` | DB-First scaffolding types (P2-43) | `DatabaseModel`, `DbIntrospector`, `ScaffoldOptions` |
| `errors.ts` | Base error hierarchy | `OrmError` (abstract root), `OrmErrorCode`, `OrmErrorOptions`, `DatabaseError`, `OptimisticConcurrencyError`, `UniqueConstraintError`, `ForeignKeyConstraintError`, `ValidationError`, `TemporalNotSupportedError`, `UnsupportedOperationError`, `MetadataError`, `DecoratorUsageError`, `BatchConfigurationError`, `InvalidIncludeError`, `OperationAbortedError` |

## Runtime surface

The overwhelming majority of this package is **type-only** — pure interfaces and type aliases that
compile away to nothing and are meant to be imported with `import type`. Only a small, deliberate
set of exports emits runtime JavaScript, and it now lives in two dedicated modules:

- **`runtime.ts`** — the three pure, dependency-free helpers: `ok()`, `err()` (the `Result`
  constructors) and the `isTemplateSqlCache()` type guard.
- **`enums.ts`** — the seven value-emitting enums: `EntityState`, `LoadingStrategy`,
  `ValueGeneratedPolicy`, `DeleteBehavior`, `StorageStrategy`, `InheritanceStrategy`,
  `QuerySplittingBehavior`. These are regular (non-`const`) string enums by design — consumers rely
  on the runtime objects (member access, `switch`, default parameters), and cross-package
  `const enum` inlining is unsafe under the monorepo's separate per-package builds.

The error classes in `errors.ts` also emit runtime code (they are classes). Everything else is
type-only. All names remain re-exported from the single `@ts-linq/types` barrel — the split is an
internal reorganization with no change to the public surface.

## Usage

```ts
import type { SqlDialect, WhereClause, Result, EntityMetadata } from '@ts-linq/types';
import { ok, err } from '@ts-linq/types';

function parse(input: string): Result<number> {
  const n = Number(input);
  return Number.isNaN(n) ? err(new Error('not a number')) : ok(n);
}
```

## Package structure

```
src/
  index.ts              # thin re-export barrel — all contracts
  sql.ts                # SQL primitives & query options
  logging.ts            # logger interfaces & telemetry DTOs
  dialect.ts            # SQL dialect contract & DML results
  middleware.ts         # middleware hooks & retry
  config.ts             # provider & connection configuration
  query-filters.ts      # global & named query filters
  results.ts            # Result<T,E> & fallback types
  cache.ts              # cache interfaces & performance options
  value-conversion.ts   # converters, generators, sequences
  metadata.ts           # ORM metadata model (central module)
  stored-procedure.ts   # stored procedure mapping
  tracking.ts           # change tracking primitives
  spatial-hierarchy.ts  # spatial & hierarchyid translators
  diagnostics.ts        # diagnostic configuration
  scaffolding.ts        # DB-first scaffolding types
  enums.ts              # runtime enums (value-emitting)
  runtime.ts            # runtime helpers — ok/err/isTemplateSqlCache
  errors.ts             # base error hierarchy
  __tests__/
    exports.check.ts    # type-level export verification
```

## Dependencies

None. This is the root of the dependency graph and must stay dependency-free.

## License

Part of the ts-linq monorepo. See the repository root for license details.
