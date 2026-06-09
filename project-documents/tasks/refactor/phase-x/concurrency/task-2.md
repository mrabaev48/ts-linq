---
status: completed
phase: phase-x
package: concurrency
priority: P1
effort: M
risk: medium
category: testing
depends_on: ["task-1.md"]
related: []
---

# Refactor: Make `ExecutionStrategy` testable and policy-driven

## Problem

`ExecutionStrategy.executeAsync` (`packages/concurrency/src/ExecutionStrategy.ts:
29-49`) implements its own retry loop with a **hard-coded real-time backoff** and
**no clock injection**, and it completely ignores the `RetryPolicy` abstraction
that the rest of the framework uses. As a result the retry behavior is neither
unit-testable nor consistent with `ResilienceManager`/`RetryPolicy`.

## Evidence

- `ExecutionStrategy.ts:44` — backoff is
  `Math.min(Math.pow(2, attempt - 1) * 1000, this.opts.maxRetryDelay)` — base
  unit hard-coded to **1000 ms**, no jitter, no injection point.
- `ExecutionStrategy.ts:46` — `await new Promise(r => setTimeout(r, delayMs))`
  uses the real timer with no abstraction.
- `ExecutionStrategy.ts:19-23` — constructor takes `ExecutionStrategyOptions` +
  an `isTransient` predicate but **no `RetryPolicy`** and **no sleeper/clock**.
- The whole inline loop duplicates the responsibility of
  `ExponentialBackoffRetryPolicy.getDelayMs` (which *does* add jitter) — two
  divergent backoff implementations in one package.
- `tests-new/ExecutionStrategy.test.ts` contains no `jest.useFakeTimers` / sleeper
  stub (grep for `setTimeout|fakeTimers|delay` returns nothing), so any test that
  exercises a retry waits real seconds or cannot assert the backoff schedule.

## Why this is bad

- **Untestable backoff:** the project mandates retry/backoff unit tests; the
  current design forces real waits, so retry-schedule behavior is effectively
  unverified.
- **Inconsistent backoff:** `ExecutionStrategy` (no jitter, base 1000 ms) vs
  `ExponentialBackoffRetryPolicy` (jitter, base 50 ms) — two answers to "how long
  to wait" in the same package.
- **Ignored abstraction:** `RetryPolicy` exists precisely to encapsulate
  `shouldRetry`/`getDelayMs`, but `ExecutionStrategy` reimplements both inline.
- Magic number `1000` with no rationale or option.

## Target architecture

Drive `ExecutionStrategy` through the `RetryPolicy` abstraction and inject an
async sleeper (clock) — dependency inversion for testability:

```ts
type Sleeper = (ms: number, signal?: AbortSignal) => Promise<void>;

class ExecutionStrategy {
  constructor(
    private readonly policy: RetryPolicy,           // shouldRetry + getDelayMs
    private readonly isTransient: (e: unknown) => boolean,
    private readonly sleep: Sleeper = defaultSleep,  // injectable for tests
  ) {}
  async executeAsync<T>(op: () => Promise<T>, inTransaction = false): Promise<T> { ... }
}
```

- Delay/jitter/cap come from `policy.getDelayMs(attempt)`; the inline `* 1000`
  formula is removed.
- The retry decision combines `isTransient(error)` **and**
  `policy.shouldRetry(error, attempt, inTransaction)` and the budget.
- Backward compatibility: keep an overload/adapter that accepts the existing
  `ExecutionStrategyOptions` and constructs a default
  `ExponentialBackoffRetryPolicy` from it, so `DatabaseFacade.createExecution
  Strategy()` (`orm/src/DatabaseFacade.ts:174-179`) keeps working.

## Proposed refactor

1. Add an injectable `Sleeper` with a real default; replace the inline
   `setTimeout` promise.
2. Introduce a `RetryPolicy`-driven backoff path; map the legacy
   `ExecutionStrategyOptions` (`maxRetryCount`, `maxRetryDelay`) onto a policy via
   an adapter so the public `DatabaseFacade` call site is unchanged.
3. Combine `isTransient` + `policy.shouldRetry` for the retry decision; honor an
   `AbortSignal` during sleep if available.
4. Remove the magic `1000` literal.

## Suggested design patterns

- **Strategy** (`RetryPolicy`) — backoff/decision encapsulated and swappable.
- **Dependency injection** (`Sleeper`/clock) — deterministic retry tests.
- **Adapter** — bridge legacy `ExecutionStrategyOptions` to a `RetryPolicy` so the
  existing constructor/consumer stay source-compatible.

## Testing plan

- **Unit (fake timers / stub sleeper):**
  - success on first try (no sleep).
  - retry on transient until success; assert sleeper called with policy delays.
  - budget exhaustion rethrows the last error.
  - non-transient error rethrows immediately (no sleep).
  - `inTransaction` path respects `policy.shouldRetry` (e.g. no retry in tx).
- **Backoff schedule:** assert the exact delay sequence from the injected policy.
- **Regression:** existing `ExecutionStrategy.test.ts` adapted to the sleeper
  stub; `DatabaseFacade.createExecutionStrategy()` still constructs a working
  strategy.

## Acceptance criteria

- [ ] `ExecutionStrategy` consumes a `RetryPolicy` for delay + decision (no inline
      `* 1000` formula).
- [ ] An injectable `Sleeper` makes backoff deterministically testable.
- [ ] Legacy `ExecutionStrategyOptions` constructor path preserved via adapter;
      `DatabaseFacade` unchanged.
- [ ] Retry unit tests cover success/transient/non-transient/budget/in-tx without
      real waits.
- [ ] `pnpm tests:unit && pnpm typecheck && pnpm lint` pass.

## Refactor order

1. Land task-1 (single retry-policy source) first.
2. Add `Sleeper` injection + remove magic number.
3. Switch decision/backoff to `RetryPolicy` behind the legacy-options adapter.
4. Add deterministic retry tests.

## Notes

Depends on task-1 so the strategy wires against the single canonical
`RetryPolicy` implementation rather than one of two duplicates.
