# core/task-1 — DatabaseProvider god-class decomposition (✅ DONE, PR #192)

Branch `audit-refactor/core-decompose-database-provider`. core `3.0.10→3.1.0` (minor), providers `→3.0.14` (patch).

## Outcome
`packages/core/src/DatabaseProvider.ts` reduced ~1056 → ~674 LOC (~432 non-comment). Thin facade:
declares `do*` abstract contract + public `IDatabaseProvider` surface, **delegates** to 8 injected
collaborators. Public method signatures byte-identical (providers compile after only the
constructor/strategy-injection edits). `< 350 LOC` target NOT fully met — residual is the
irreducible provider contract (abstract CRUD/dialect decls, accessors, streamRows, queryJunction) +
dual constructor; further splitting would fragment the contract (optional follow-up).

## Collaborators (all in packages/core/src/, all internal except where noted)
- `logging/CompositeSqlLogger.ts` (Composite) — replaces static `mergeLoggers`; internal (NOT
  exported — separate public `@ts-linq/composite-sql-logger` pkg peer-deps core, can't reuse → cycle).
- `ProviderConfig.ts` (Parameter Object) — **public API**. Required `providerName`+`connectionString`;
  optional logger/middlewares/softDelete/retryPolicy/poolOptions/healthCheck/circuitOptions/analysis/
  savepointStrategy/sequenceStrategy. Constructor overloads: `(config: ProviderConfig)` +
  `@deprecated (connectionString, ...8 positional)`. Validates providerName via `ValidationError`.
- `interceptors/InterceptorDispatcher.ts` (Observer) — 4 arrays + configure + connection/transaction
  notify + commandExecuting(propagates)/commandExecuted(isolates)/entityMaterialized.
- `analysis/QueryAnalyzer.ts` (Strategy/Policy) — maybeAnalyzeQuery; ctor deps `now/random/sleep`
  injectable; `analyze(input, ctx)` where ctx carries inTransaction/providerName/logger/middlewares/
  getExplainPlan. Provider builds ctx via `analysisContext()`.
- `execution/QueryExecutionPipeline.ts` (Template Method) — `execute(fn, req)`; req has onStart/
  beforeExecute/afterExecute/analyze hooks closing over provider. Holds ResilienceManager.
- `middleware/MiddlewareDispatcher.ts` (Observer) — middleware fan-out; lazy `() => this.middlewares`.
- `batch/BatchTransactionRunner.ts` — runAll(entities, op); insertMany/updateMany/upsertMany delegate.
- `strategies/SavepointStrategy.ts` (+`AnsiSavepointStrategy`) & `strategies/SequenceStrategy.ts`
  (+`UnsupportedSequenceStrategy`, +`SequenceExecutionPort`) — **public API**.

## providerName latent-bug fix
8-arg ctor built ResilienceManager/HealthMonitor with providerName='unknown' (subclass set real
name after super()). Now providers pass real name via ProviderConfig → labelled correctly. Regression
in `ProviderConfig.test.ts` (forceOpen → logger.circuit provider field).

## Savepoint/Sequence (full strategy injection — user decision)
- Interfaces in core; dialect impls in provider pkgs: `provider-postgres/src/strategies/
  PostgresSequenceStrategy`, `provider-mssql/src/strategies/{MssqlSavepointStrategy,MssqlSequenceStrategy}`,
  `provider-mysql/src/strategies/MySqlSequenceStrategy`.
- Base `nextSequenceValue` → `sequenceStrategy.nextValue(this, ...)` (this satisfies
  SequenceExecutionPort via public executeQuery/executeNonQuery/providerLabel).
- Base `createSavepoint/rollbackToSavepoint/releaseSavepoint` → strategy SQL (null=no-op) executed via
  protected `runSavepointStatement(sql)` (default `executeNonQuery`).
- **MySQL quirk**: mysql2 `pool.execute()` (prepared) can't run SAVEPOINT → MySQL overrides ONLY
  `runSavepointStatement` to route via `pool.query` (SQL stays ANSI default). 3 method overrides → 1.
- MSSQL: T-SQL SAVE/ROLLBACK TRANSACTION, release=null. Providers drop their savepoint/sequence
  method overrides; dialect strategies use typed `DatabaseError` (not bare throw).

## Gotchas / parity notes
- `beforeExecute`/`afterExecute` are protected contract — called DIRECTLY by subclasses incl.
  production `MySqlProvider` + testkits/orm TestProvider stubs. Signatures unchanged; `lastExecuteStartedAt`
  kept. `notifyEntityMaterialized` called by all 3 providers + RowMaterializer (duck-typed) + ProviderStub.
- QueryAnalyzer rate-limit window NEVER re-seeds (windowStartMs only set in reset branch) — preserved
  exactly as latent quirk; documented in test + flagged as follow-up tech debt.
- Tests import `jest` globally (NOT from `@jest/globals`) when using `jest.SpyInstance`/lenient
  `mockImplementation()` — jest-mock v30 strict typing breaks the @jest/globals import.
- ESLint `promise-function-async` auto-adds `async` → UnsupportedSequenceStrategy.nextValue is async
  (rejects, not sync throw).
- Rebuild core dist before typechecking providers (they resolve @ts-linq/core via dist .d.ts).

## Validation: typecheck/lint/build/arch:deps/cycles/dead all green; test:unit 296 suites/3163 tests.
Integration/e2e NOT run (need real DBs, hang — user runs foreground). Next core tasks: 3,7,8,9.
