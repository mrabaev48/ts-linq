# refactor concurrency/task-2 — ExecutionStrategy testable + policy-driven (✅ done)

Branch: `audit-refactor/concurrency-execution-strategy-injectable`. Concurrency package now
fully complete (task-1 + task-2). Next strict-sequential step = `core` (step 7).

## What changed

`packages/concurrency/src/ExecutionStrategy.ts` rewritten:

- **`Sleeper` type** (exported): `type Sleeper = (ms: number, signal?: AbortSignal) => Promise<void>`.
  `defaultSleep` = `setTimeout`-backed, `AbortSignal`-aware (clears timer + rejects with
  `signal.reason` on abort; early-rejects if already aborted).
- **`RetryPolicy`-driven**: `executeAsync` uses `policy.getDelayMs?.(attempt) ?? 0` for delay
  (`getDelayMs` is optional on the `RetryPolicy` interface in `@ts-linq/types`) and
  `policy.shouldRetry(error, attempt, inTransaction)` + `isTransient(error)` for the retry
  decision. The inline `Math.pow(2, attempt-1) * 1000` formula and the magic `1000` are gone.
- **Budget stays on the strategy**: `maxRetryCount` is a constructor field, NOT in the policy —
  `RetryPolicy` is per-attempt only (no max-attempts concept). Semantics preserved:
  `maxRetryCount=N` → N attempts, N-1 sleeps, last error rethrown.
- **New primary constructor**: `(policy: RetryPolicy, isTransient: (e)=>boolean, maxRetryCount: number, sleep: Sleeper = defaultSleep)`.
- **Legacy adapter** (single shim, `@deprecated`): `static fromOptions(opts: ExecutionStrategyOptions, isTransient, sleep?)`
  → `new ExecutionStrategy(new ExponentialBackoffRetryPolicy({ maxDelayMs: opts.maxRetryDelay }), isTransient, opts.maxRetryCount, sleep)`.
  NOTE: `ExponentialBackoffRetryPolicy` ctor takes `ExponentialBackoffOptions` (baseDelayMs/factor/maxDelayMs),
  NOT `ExecutionStrategyOptions` — only `maxRetryDelay → maxDelayMs` maps.
- `executeAsync<T>(operation, inTransaction = false, signal?: AbortSignal)` — extra params are
  additive/optional (backward compatible for existing `executeAsync(op)` callers).

## Call sites / compat

- Only non-test consumer: `packages/orm/src/DatabaseFacade.ts` `createExecutionStrategy()` —
  changed 1 internal line `new ExecutionStrategy(opts, ...)` → `ExecutionStrategy.fromOptions(opts, ...)`.
  orm public surface unchanged. Backoff timing on this path intentionally unified onto the policy
  (base 50 ms + jitter, capped at `maxRetryDelay`) vs old base-1000 ms no-jitter.

## Tests

`packages/concurrency/tests-new/ExecutionStrategy.test.ts` fully rewritten — 16 tests, all using a
`jest.fn<Sleeper>()` stub (no real waits). 3 describe blocks (kept under the 200-line
max-lines-per-function lint rule by hoisting helpers + splitting). Covers: first-try-no-sleep,
transient→retry→success, budget exhaustion (N-1 sleeps), non-transient immediate rethrow, exact
delay schedule, missing getDelayMs⇒0, inTransaction forwarding, default policy no-retry-in-tx,
AbortSignal pass-through, and `fromOptions` adapter (budget mapping + maxRetryDelay cap).

## Validation outcomes (all green)

typecheck ✅, lint ✅ (0 errors), test:unit ✅ (3076), test:integration ✅ (464 + 2 skipped),
test:e2e ✅ (19 suites), build ✅, arch:deps ✅, arch:cycles ✅, arch:dead ✅.
NB: root scripts are `test:unit`/`test:integration`/`test:e2e` (NOT `tests:*` as CLAUDE.md hints).

## Changeset / tech debt

- Changeset: `@ts-linq/concurrency` **major** (public `ExecutionStrategy` ctor signature changed
  incompatibly), `@ts-linq/orm` **patch** (internal call-site + backoff-timing change). Migration:
  use `ExecutionStrategy.fromOptions(opts, isTransient)` or pass a `RetryPolicy`.
- Tech debt: `fromOptions` is `@deprecated` — removal target when `orm` is refactored (step 7) to
  pass a `RetryPolicy` directly. `ExecutionStrategyOptions.errorCodesToAdd` is still NOT mapped onto
  any policy (transient classification stays in the provider's `checkTransientError`).
