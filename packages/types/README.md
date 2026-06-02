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

- **SQL primitives** — `SqlParameter`, `SqlWithParams`, `SqlWithReturning`, `SqlQueryResult`.
- **Query clauses** — `WhereClause`, `OrderByClause`, `JoinClause`, `GroupByClause`,
  `TemporalClause`, `QueryOptions`, `CteDefinition`, `JoinType`.
- **Dialect / provider contracts** — `SqlDialect`, `BaseProviderConfig`, `PostgresConfig`,
  `MySqlConfig`, `MssqlConfig`.
- **Mapping options** — `ColumnOptions`, `RelationshipOptions`, `SoftDeleteOptions`.
- **Resilience / concurrency** — `RetryPolicy`, `ExecutionStrategyOptions`,
  `ConnectionPoolOptions`, `ConnectionHealthCheckOptions`, `CircuitState`,
  `ConnectionHealthStatus`.
- **Telemetry info objects** — `QueryStartInfo`, `QueryEndInfo`, `RetryInfo`, `TransactionInfo`,
  `CacheInfo`, `ConnectionHealthInfo`, `CircuitEventInfo`, `FallbackInfo`, `HedgedWinInfo`,
  `QueryAnalysisInfo`, `CacheSizeInfo`.
- **Logging** — `Logger`, `SqlLogger`, `SqlLoggerFactory`.
- **Lifecycle / middleware** — `OrmMiddleware`, `BeforeExecuteInfo`, `AfterExecuteInfo`,
  `EntityChangeContext`.
- **Query filters** — `GlobalFilter`, `QueryFilterMetadata`.
- **Functional helpers** — `Result<T, E>`, `ok()`, `err()`, and the fallback contracts
  (`FallbackOperation`, `FallbackRequest`, `QueryFallback`, `FallbackPolicy`).
- **Errors** — the base error hierarchy in `errors.ts`.
- **Enums re-exported elsewhere** — e.g. `EntityState`, `QuerySplittingBehavior`.

## Usage

```ts
import type { SqlDialect, WhereClause, Result } from '@ts-linq/types';
import { ok, err } from '@ts-linq/types';

function parse(input: string): Result<number> {
  const n = Number(input);
  return Number.isNaN(n) ? err(new Error('not a number')) : ok(n);
}
```

## Package structure

```
src/
  index.ts    # the single public barrel — all contracts
  errors.ts   # base error hierarchy
```

## Dependencies

None. This is the root of the dependency graph and must stay dependency-free.

## License

Part of the ts-linq monorepo. See the repository root for license details.
