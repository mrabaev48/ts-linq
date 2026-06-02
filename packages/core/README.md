# @ts-linq/core

> Core ORM runtime: the `DatabaseProvider` contract, mapping decorators, relationship loading,
> batch operations, interceptors, DDL building, and resilience/health utilities.

This package is the heart of the runtime that providers extend and that `query`/`orm` build upon.
It defines the abstract provider, the decorator-based mapping surface, eager/lazy loading,
batching, the interceptor pipeline, and supporting infrastructure (health, resilience, owned-entity
hydration, spatial/hierarchy helpers).

## Installation

```bash
pnpm add @ts-linq/core
```

## What lives here

- **`DatabaseProvider`** — the abstract base contract every provider implements (connect, query,
  transactions, batching hooks, DDL).
- **Decorators** — `@Entity`, `@Column`, `@PrimaryKey`, relationship decorators, `@CachePolicy`,
  `@ValidIf` (re-exporting metadata wiring).
- **Loading** — `EntityLoader`, `RelationshipLoader`, `LazyLoadingProxy`, `LoadingStrategy`.
- **Batch operations** — `BatchExecutor`, `BatchInsert/Update/Delete/Upsert`, `BatchPlan`.
- **Interceptors** — `IDbCommandInterceptor`, `IDbConnectionInterceptor`,
  `IDbTransactionInterceptor`, `IMaterializationInterceptor`, `ISaveChangesInterceptor`,
  `InterceptionResult`.
- **DDL** — `DdlBuilder`, `DdlStrategy`.
- **Resilience & health** — `ResilienceManager`, `HealthMonitor`.
- **Domain helpers** — spatial geometry, `hierarchy-id`, `OwnedEntityHydrator`,
  `QueryTrackingBehavior`.

## Usage

```ts
import { Entity, Column, PrimaryKey } from '@ts-linq/core';

@Entity('users')
class User {
  @PrimaryKey() id!: number;
  @Column() email!: string;
}
```

## Package structure

```
src/
  DatabaseProvider.ts            # abstract provider contract
  decorators/                    # @Entity, @Column, @PrimaryKey, relationships ...
  loading/                       # EntityLoader, RelationshipLoader, lazy loading
  batch/                         # batch insert/update/delete/upsert + executor
  interceptors/                  # command/connection/transaction/save interceptors
  DdlBuilder.ts, DdlStrategy.ts  # DDL generation
  Resilience/, Health/           # resilience manager, health monitor
  spatial/, hierarchy/           # spatial + hierarchy-id helpers
  index.ts                       # public barrel
```

## Dependencies

- `@ts-linq/types`, `@ts-linq/metadata`, `@ts-linq/metrics-safe`, `@ts-linq/ast`
- `typescript` (peer)

## License

Part of the ts-linq monorepo. See the repository root for license details.
