---
status: not-started
phase: phase-x
package: core
priority: P0
effort: XL
risk: high
category: architecture
depends_on: []
related: ['core/task-2.md', 'core/task-7.md']
---

# Refactor: Decompose the `DatabaseProvider` god class (~1005 LOC, ~10 responsibilities)

## Problem
`packages/core/src/DatabaseProvider.ts` is a single abstract base class of 1005 lines
(`DatabaseProvider`, line 40) that concentrates a large number of unrelated
responsibilities behind one inheritance root that every concrete provider must extend:

1. CRUD contract (`insert`/`update`/`delete`/`findById`/`findAll`/`findWhere`/`findWhereIn`, lines 142-172).
2. Batch fan-out helpers (`insertMany`/`updateMany`/`upsert`/`upsertMany`, lines 175-229).
3. Query execution + retry orchestration (`executeQuery`/`executeNonQuery`/`executeWithRetry`, lines 231-370).
4. Streaming/pagination (`streamRows`/`buildChunkSql`, lines 258-296).
5. Query-performance analysis + EXPLAIN sampling/rate-limiting (`maybeAnalyzeQuery`/`deriveRecommendations`, lines 402-487).
6. Transient-error classification (`isTransientError`, line 490).
7. Circuit-breaker / resilience delegation (lines 501-510, 667-675).
8. Logger merging (`mergeLoggers`, lines 540-639 — ~100 lines of boilerplate).
9. Interceptor partitioning + ~14 connection/transaction/command notification fan-out helpers (lines 381-391, 684-746, 882-1004).
10. Savepoint/sequence ANSI-SQL emission (`createSavepoint`/`rollbackToSavepoint`/`releaseSavepoint`/`nextSequenceValue`, lines 823-858).

This violates the Single Responsibility Principle and makes the abstract base both a
contract *and* a kitchen-sink implementation. Concrete providers (postgres/mysql/mssql)
must inherit all of it, even features they do not use, and cannot compose behaviour à la carte.

## Evidence
- `packages/core/src/DatabaseProvider.ts:40` — `export abstract class DatabaseProvider implements IDatabaseProvider`.
- 30+ protected fields (lines 41-77) including resilience, health, analysis, interceptor arrays.
- `executeWithRetry` (line 310) inlines logging, `beforeExecute`/`afterExecute`, analysis, and resilience in one method.
- `mergeLoggers` (line 540) — 100 lines of per-method try/catch fan-out hard-coded into the provider.
- Notification helpers `notifyConnectionOpening`…`notifyTransactionRolledBack` (lines 884-1004) — 10 near-identical methods.
- Constructor (line 83) has 8 positional parameters (`connectionString, logger, middlewares, softDelete, retryPolicy, poolOptions, healthCheck, circuitOptions`).

## Why this is bad
- **Testability**: cannot unit-test analysis sampling, logger merging, or interceptor fan-out without instantiating a full provider subclass with a live connection contract.
- **Extensibility**: adding a new cross-cutting concern (e.g. tracing) means editing the base class every provider inherits — a wide blast radius.
- **Maintainability**: a 1005-line file with 8-arg constructor is hard to reason about; the `providerName` ordering bug is even called out in a code comment (line 104).
- **ORM risk**: every provider package is coupled to the full surface; a change here forces re-validation of all dialect packages.

## Target architecture
Apply SRP + composition-first + dependency inversion. Keep `DatabaseProvider` as a *thin*
abstract port that declares the provider contract (the `do*` abstract methods + dialect),
and extract the cross-cutting orchestration into injected collaborators:

- `QueryExecutionPipeline` — owns `executeWithRetry`, logging start/end, before/after hooks (Template Method / Chain of Responsibility over interceptors).
- `QueryAnalyzer` — owns `maybeAnalyzeQuery`, sampling, rate-limiting, EXPLAIN timeout (Strategy + Policy).
- `InterceptorDispatcher` — owns connection/transaction/command/materialization fan-out (Observer / Mediator).
- `CompositeSqlLogger` — replaces `mergeLoggers` static (Composite pattern).
- `ProviderConfig` value object — replaces the 8-arg constructor (Parameter Object).
- `SavepointStrategy` / `SequenceStrategy` — ANSI defaults overridable per dialect (Strategy).

The base provider then *delegates* to these collaborators, which can be unit-tested in isolation.

## Proposed refactor
1. Introduce `interface QueryExecutionPipeline { execute<T>(fn, ctx): Promise<T> }` and move `executeWithRetry` body there; provider holds an instance.
2. Extract `QueryAnalyzer` class with the body of `maybeAnalyzeQuery`/`deriveRecommendations`; inject via config.
3. Extract `InterceptorDispatcher` holding the four interceptor arrays + all `notify*` helpers; provider calls `dispatcher.connectionOpening()` etc.
4. Replace `mergeLoggers` with a `CompositeSqlLogger` class (one constructor taking N loggers).
5. Replace the 8-positional-arg constructor with a single `ProviderConfig` object (keep a deprecated positional overload during migration for backward compat).
6. Error-handling model: see `core/task-7.md` (typed errors instead of `throw new Error`).
7. Tests: add isolated unit tests per collaborator.
8. Migration: keep `DatabaseProvider`'s public method signatures identical; only internals move, so concrete providers do not change.

## Suggested design patterns
- **Template Method** — the `connect`/`disconnect`/`beginTransaction` flows stay as templates calling `do*` + dispatcher.
- **Strategy** — `QueryAnalyzer`, `SavepointStrategy`, `SequenceStrategy`, transient-error classifier.
- **Composite** — `CompositeSqlLogger` for fan-out logging.
- **Observer / Mediator** — `InterceptorDispatcher` decouples lifecycle events from the provider.
- **Parameter Object** — `ProviderConfig` collapses the 8-arg constructor.
- **Facade** — `DatabaseProvider` becomes a thin facade over collaborators.

## Testing plan
- Unit: `QueryAnalyzer` sampling/rate-limit/EXPLAIN-timeout deterministically (mock `Date.now`/`Math.random`).
- Unit: `InterceptorDispatcher` calls each registered interceptor in order, isolates errors.
- Unit: `CompositeSqlLogger` forwards to all delegates and isolates throwing delegates.
- Contract: existing provider integration tests must pass unchanged (public API stable).
- Regression: retry/circuit behaviour parity before/after extraction.

## Acceptance criteria
- [ ] `DatabaseProvider.ts` reduced to the provider contract + thin delegation (< 350 LOC).
- [ ] `QueryAnalyzer`, `InterceptorDispatcher`, `CompositeSqlLogger`, `ProviderConfig` exist as separate, unit-tested units.
- [ ] Public method signatures of `DatabaseProvider` unchanged; provider packages compile without edits.
- [ ] `mergeLoggers` static removed; replaced by `CompositeSqlLogger`.
- [ ] All cluster validations (`typecheck`, `lint`, `tests:unit`, `build`) pass.

## Refactor order
Do after `core/task-7` (error model) lands so extracted collaborators adopt typed errors from the start. This is the anchor task for the package.

## Notes
The constructor comment at line 104 ("providerName is 'unknown' here until subclass sets it") is a latent bug: `ResilienceManager`/`HealthMonitor` are constructed with `providerName='unknown'` before subclasses set the real name. The `ProviderConfig` refactor should make `providerName` a required up-front value to fix this.
