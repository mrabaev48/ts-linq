---
"@ts-linq/concurrency": major
"@ts-linq/orm": patch
---

Make `ExecutionStrategy` policy-driven and testable.

`ExecutionStrategy` now consumes a `RetryPolicy` for both the per-attempt backoff
delay (`getDelayMs`) and the retry decision (`shouldRetry`); the inline
`Math.pow(2, attempt - 1) * 1000` formula and the magic `1000` literal are removed.
The blocking `setTimeout` is replaced by an injectable `Sleeper`
(`type Sleeper = (ms: number, signal?: AbortSignal) => Promise<void>`, default
`setTimeout`-backed and `AbortSignal`-aware), so retry schedules are now
deterministically unit-testable without real waits. `executeAsync` gains optional
`inTransaction` and `signal` parameters (backward compatible — both default).

**BREAKING (`@ts-linq/concurrency`):** the `ExecutionStrategy` constructor signature
changed from `(opts: ExecutionStrategyOptions, isTransient)` to
`(policy: RetryPolicy, isTransient, maxRetryCount: number, sleep?: Sleeper)`.

Migration: replace `new ExecutionStrategy(opts, isTransient)` with the new adapter
`ExecutionStrategy.fromOptions(opts, isTransient)`, or pass an explicit `RetryPolicy`
to the constructor.

`@ts-linq/orm`'s `DatabaseFacade.createExecutionStrategy()` is updated internally to
use `ExecutionStrategy.fromOptions`; its public surface is unchanged. As a result, the
default retry backoff timing on that path is unified onto `ExponentialBackoffRetryPolicy`
(base 50 ms + jitter, capped at `maxRetryDelay`) instead of the previous base-1000 ms
no-jitter schedule.
