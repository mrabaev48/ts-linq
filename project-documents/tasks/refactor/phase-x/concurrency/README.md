# Refactor Audit: concurrency

## Package responsibility

`@ts-linq/concurrency` provides retry/resilience primitives for transient
database failures:

- `ExecutionStrategy` (`src/ExecutionStrategy.ts`) — wraps an async block in a
  retry loop with exponential backoff; mirrors EF Core's
  `IExecutionStrategy.ExecuteAsync`. Consumed by
  `DatabaseFacade.createExecutionStrategy()` in `@ts-linq/orm`.
- `RetryPolicies` (`src/RetryPolicies.ts`) — `ExponentialBackoffRetryPolicy`,
  `NoRetryPolicy`, `FixedIntervalRetryPolicy` implementing `RetryPolicy` from
  `@ts-linq/types`.

The package is small (50 + 61 LOC) and depends only on `@ts-linq/types`.

## Current architectural problems

1. **Triplicate duplication with `@ts-linq/core`.** `core/src/utils/
   RetryPolicies.ts` contains byte-for-byte the same three classes
   (`ExponentialBackoffRetryPolicy`, `NoRetryPolicy`, `FixedIntervalRetryPolicy`),
   the same `ExponentialBackoffOptions` interface, and the same doc comments.
   Two packages own the "same" retry policies; consumers can import either and
   `instanceof` checks across the boundary silently fail.
2. **`RetryPolicy` is dead within this package.** `ExecutionStrategy` does **not**
   use any `RetryPolicy`; it has its own inline retry loop with a hard-coded
   `Math.pow(2, attempt - 1) * 1000` backoff. Meanwhile `core`'s
   `ResilienceManager` is the actual consumer of `RetryPolicy`. So the package
   ships two retry abstractions that never meet.
3. **Untestable backoff (hard-coded real delays).** `ExecutionStrategy.execute
   Async` calls `setTimeout` with a base of `* 1000` ms and provides no clock/
   delay injection. Retry tests must either wait real seconds or be unable to
   assert backoff. (`tests-new/ExecutionStrategy.test.ts` contains no fake-timer
   setup.)
4. **No jitter in `ExecutionStrategy`** while `ExponentialBackoffRetryPolicy`
   *does* add jitter — inconsistent backoff behavior between the two mechanisms
   in the same package.
5. **Weak transient classification.** `ExponentialBackoffRetryPolicy.shouldRetry`
   ignores the error entirely and only checks `!inTransaction`; the doc claims
   "basic transient detection" that does not exist.
6. **Barrel `export *`** of both modules with no `@internal` separation (minor).

## Refactor goals

- Eliminate the cross-package duplication: one canonical home for retry policies.
- Unify the two retry mechanisms (`ExecutionStrategy` should consume a
  `RetryPolicy` instead of an inline loop), or clearly separate their roles.
- Make backoff injectable (clock/sleeper) so retries are unit-testable.
- Honor real transient classification via the injected predicate.

## Recommended task order

| Order | Task | Priority | Status | Reason |
|---:|---|---|---|---|
| 1 | task-1.md — De-duplicate RetryPolicies across concurrency/core | P1 | ✅ Completed | Two copies of the same public classes; boundary confusion |
| 2 | task-2.md — Make `ExecutionStrategy` testable + policy-driven | P1 | ✅ Completed | Hard-coded delays; ignores `RetryPolicy`; not unit-testable |

> **Package status: ✅ done (task-1, task-2).**

> **task-1 outcome (completed).** Canonical home is `@ts-linq/concurrency`
> (`src/RetryPolicies.ts`). `@ts-linq/core` now re-exports the three policy classes
> and `ExponentialBackoffOptions` from `core/src/utils/RetryPolicies.ts` via a pure
> named facade — all existing import paths stay intact and cross-package
> `instanceof` holds (one class object monorepo-wide). Direction `core → concurrency`
> introduces no cycle (`concurrency` depends only on `@ts-linq/types`) and is
> permitted by `.dependency-cruiser.cjs`.

> **task-2 outcome (completed).** `ExecutionStrategy` now consumes a `RetryPolicy`
> for both the per-attempt delay (`getDelayMs`) and the retry decision
> (`shouldRetry`); the inline `Math.pow(2, attempt-1) * 1000` backoff and the magic
> `1000` literal are gone. An injectable `Sleeper`
> (`type Sleeper = (ms, signal?) => Promise<void>`, default `setTimeout`-backed,
> `AbortSignal`-aware) replaces the raw `setTimeout`, so retry schedules are
> deterministically unit-testable (16 stub-sleeper tests, no real waits). The retry
> budget (`maxRetryCount`) stays a field on the strategy because `RetryPolicy` is
> per-attempt only. Backward compatibility: the static `ExecutionStrategy.fromOptions`
> adapter bridges the legacy `ExecutionStrategyOptions` shape onto an
> `ExponentialBackoffRetryPolicy` (`maxRetryDelay → maxDelayMs`); `DatabaseFacade`'s
> public surface is unchanged (one internal line now calls `fromOptions`). The
> default `DatabaseFacade` path's backoff timing is intentionally unified onto the
> policy (base 50 ms + jitter, capped at `maxRetryDelay`).

## Dependencies on other packages

Depends on `@ts-linq/types` (`RetryPolicy`, `ExecutionStrategyOptions`).
Consumed by `@ts-linq/orm` (`DatabaseFacade`). Conceptually overlaps with
`@ts-linq/core` (`ResilienceManager`, duplicated `utils/RetryPolicies.ts`).

## Testing strategy

- Fake-timer / injected-sleeper unit tests for backoff sequences and cap.
- Transient vs non-transient short-circuit tests (budget exhaustion, predicate).
- A single-source-of-truth test asserting the policy classes are imported from
  one package only (no duplicate definitions) after task-1.

## Notes

This package is healthy in size but architecturally ambiguous: it competes with
`@ts-linq/core`'s resilience layer. The two tasks aim to make `concurrency` the
single canonical home and wire `ExecutionStrategy` to the policies it currently
ignores.
