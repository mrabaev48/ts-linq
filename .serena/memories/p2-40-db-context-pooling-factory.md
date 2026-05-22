# P2-40: DbContext Pooling & IDbContextFactory — Implemented

**Status:** done  
**Branch:** feat/p2-40-db-context-pooling-factory  
**Package:** @ts-linq/orm (minor bump pending)

## New files

| File | Purpose |
|------|---------|
| `packages/orm/src/factory/IDbContextFactory.ts` | `IDbContextFactory<T>` interface: `createDbContext()` / `createDbContextAsync()` |
| `packages/orm/src/factory/DbContextFactory.ts` | Non-pooled factory — new instance per call |
| `packages/orm/src/factory/index.ts` | Public functions `addDbContextFactory` / `addDbContextPool` |
| `packages/orm/src/pooling/DbContextPool.ts` | LIFO stack pool; `acquire()` / `release()` / `dispose()`; default maxSize=128 |
| `packages/orm/src/pooling/PooledDbContextFactory.ts` | Pooled factory; sets `_setPoolReturnHook` on leased context |
| `packages/orm/src/lifecycle/resetContext.ts` | Thin wrapper: calls `ctx.reset()` |

## DbContext.ts changes

- `_returnToPool?: () => Promise<void>` — private, set by pooled factory
- `reset(): void` — **public**; clears ChangeTracker, CacheCoordinator, sets `_transactionDepth = 0`
- `[Symbol.asyncDispose](): Promise<void>` — calls `_returnToPool` if set, else `dispose()`
- `_setPoolReturnHook(fn)` — @internal, called by PooledDbContextFactory
- `changeTracker` getter promoted from `protected` to **public** (EF Core parity)

## Public API

```ts
import { addDbContextFactory, addDbContextPool, IDbContextFactory } from '@ts-linq/orm';

const factory = addDbContextFactory(AppContext, { provider });
const pooled = addDbContextPool(AppContext, { provider }, { poolSize: 32 });

await using const ctx = await pooled.createDbContextAsync(); // auto-returns to pool
```

## Tests

- Unit: `packages/orm/tests-new/DbContextPool.test.ts`, `DbContextFactory.test.ts`, `PooledDbContextFactory.test.ts`
- Integration: `packages/integration-tests/tests-new/07-advanced-features/pooling.test.ts`
- E2E: `packages/e2e-tests/tests/pooling/db-context-pooling.e2e.test.ts`

## Validation results (all pass)

- typecheck OK | lint OK (0 errors) | test:unit OK 2210 tests | test:integration OK | test:e2e OK | build OK
- arch:deps OK | arch:cycles OK | arch:dead OK

## Architectural notes

- Pool is LIFO (stack), single-process safe (no thread sync needed in Node.js)
- Reset does NOT disconnect provider — connection stays alive for next checkout
- `Symbol.asyncDispose` enables `await using` on all contexts; pooled contexts recycled, non-pooled disposed
- `changeTracker` is now public (was protected) — aligns with EF Core and enables external diagnostics
- No external dependencies added — pool is ~50 LOC as recommended in the task plan
- EF Core naming preserved verbatim: `IDbContextFactory`, `addDbContextPool`, `addDbContextFactory`
