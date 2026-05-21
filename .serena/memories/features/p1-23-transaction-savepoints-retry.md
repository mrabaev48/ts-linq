# P1-23: Transaction Savepoints and ExecutionStrategy (EnableRetryOnFailure)

## Status
Implemented and merged — PR #93 on branch `feat/p1-23-transaction-savepoints-retry`.

## New Public APIs

### `@ts-linq/orm`
- `DatabaseFacade.beginTransactionAsync(): Promise<DbContextTransaction>` — начинает транзакцию и возвращает объект с поддержкой savepoints и `await using`
- `DatabaseFacade.createExecutionStrategy(): ExecutionStrategy` — создаёт стратегию retry, параметризованную через `enableRetryOnFailure`
- `DbContextOptionsBuilder.enableRetryOnFailure(options: ExecutionStrategyOptions): this` — конфигурирует retry-поведение

### `DbContextTransaction` (`packages/orm/src/transactions/DbContextTransaction.ts`)
Implements `AsyncDisposable` (`[Symbol.asyncDispose]` — auto-rollback on scope exit).
Methods: `createSavepointAsync(name)`, `rollbackToSavepointAsync(name)`, `releaseSavepointAsync(name)`, `commitAsync()`, `rollbackAsync()`.
Internally delegates to `DatabaseProvider` savepoint methods and injected commit/rollback callbacks from `DbContext`.

### `@ts-linq/concurrency`
- `ExecutionStrategy` class — retry loop with exponential backoff: `executeAsync<T>(fn: () => Promise<T>): Promise<T>`
- Delay formula: `Math.min(2^(attempt-1) * 1000, maxRetryDelay)`

### `@ts-linq/types`
- `ExecutionStrategyOptions` interface: `{ maxRetryCount: number; maxRetryDelay: number; errorCodesToAdd?: string[] | null }`

## Provider Enhancements

### `DatabaseProvider` (`packages/core/src/DatabaseProvider.ts`)
Added non-abstract public virtual methods (ANSI SQL defaults):
- `createSavepoint(name: string): Promise<void>` → `SAVEPOINT name`
- `rollbackToSavepoint(name: string): Promise<void>` → `ROLLBACK TO SAVEPOINT name`
- `releaseSavepoint(name: string): Promise<void>` → `RELEASE SAVEPOINT name`
- `checkTransientError(error: unknown): boolean` — public facade over protected `isTransientError`

### MSSQL overrides (`MssqlProvider.ts`)
Uses T-SQL syntax: `SAVE TRANSACTION name` / `ROLLBACK TRANSACTION name`. `releaseSavepoint` is no-op (T-SQL has no equivalent).

### Transient error code tables
- `packages/provider-postgres/src/transientErrorCodes.ts` — PG codes: 40001, 40P01, 08006, 08001, 08004, 57P01-57P03
- `packages/provider-mysql/src/transientErrorCodes.ts` — MySQL errno: 1213, 1205, 2013, 2006, 1047
- `packages/provider-mssql/src/transientErrorCodes.ts` — MSSQL numbers: 1205, 1222, 49918, 49919, 49920, 4060, 40197, 40501, 40613, 10928, 10929, 10053, 10054, 10060

All three providers override `isTransientError()` using their respective tables.

## Architecture Notes
- **No breaking changes**: existing `beginTransaction()` / `commitTransaction()` / `rollbackTransaction()` untouched; `beginTransactionAsync()` is purely additive.
- **Callback injection**: `DbContextTransaction` receives commit/rollback as callbacks from `DbContext` to preserve `_transactionDepth` counter semantics.
- **Dependency**: `@ts-linq/orm` now depends on `@ts-linq/concurrency` (`workspace:*`). `packages/orm/tsconfig.json` references `../concurrency`.
- **`@ts-linq/concurrency` package.json**: Added `main`/`module`/`types`/`exports` fields (previously missing).
- **`DbContextOptions`** in `@ts-linq/core` gained `executionStrategy?: ExecutionStrategyOptions`.
- **`DbSetContext`** interface gained `beginTransaction?`, `commitTransaction?`, `rollbackTransaction?`, `executionStrategyOptions?`.

## Tests
- Unit: `packages/orm/tests-new/savepoints.test.ts` (15 tests), `packages/concurrency/tests-new/ExecutionStrategy.test.ts` (8 tests)
- Integration: `packages/integration-tests/tests-new/postgres/savepoints.integration.test.ts` (skips without POSTGRES_URL)
- E2E: `packages/e2e-tests/tests/transactions/savepoints.e2e.test.ts` (skips without DB env vars)

## Docs
`apps/docs/execution-strategy.md` — idempotency warning and usage examples for `executeAsync`.
