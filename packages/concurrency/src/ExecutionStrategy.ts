import type { ExecutionStrategyOptions, RetryPolicy } from '@ts-linq/types';

import { ExponentialBackoffRetryPolicy } from './RetryPolicies';

export type { ExecutionStrategyOptions };

/**
 * Async clock abstraction used by {@link ExecutionStrategy} to wait between
 * retries. Injectable so backoff timing can be made deterministic in tests
 * (pass a stub that resolves immediately) instead of waiting real time.
 *
 * @param ms     delay in milliseconds.
 * @param signal optional abort signal; when it aborts, the returned promise
 *               rejects with `signal.reason` and the pending timer is cleared.
 */
export type Sleeper = (ms: number, signal?: AbortSignal) => Promise<void>;

/** Real-clock {@link Sleeper}: a `setTimeout`-backed delay honoring `AbortSignal`. */
const defaultSleep: Sleeper = async (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });

/**
 * Wraps a user-supplied async block in a retry loop driven by a {@link RetryPolicy}.
 * Mirrors EF Core's `IExecutionStrategy.ExecuteAsync`.
 *
 * Backoff delay, jitter, and the per-attempt retry decision come from the injected
 * `RetryPolicy` (the single source of truth shared with `ResilienceManager`); the
 * maximum number of attempts is the budget owned by this strategy. The clock is an
 * injectable {@link Sleeper} so retry schedules are unit-testable without real waits.
 *
 * Usage:
 *   const strategy = context.database.createExecutionStrategy();
 *   await strategy.executeAsync(async () => {
 *     // idempotent work — may be retried on transient failures
 *   });
 *
 * The operation passed to `executeAsync` MUST be idempotent: it may be called
 * multiple times if a transient error occurs. Do not rely on side-effects from
 * earlier attempts being visible in later ones.
 */
export class ExecutionStrategy {
  /**
   * @param policy        backoff schedule + per-attempt retry decision
   *                      (`getDelayMs` / `shouldRetry`).
   * @param isTransient   predicate classifying whether an error is worth retrying.
   * @param maxRetryCount retry budget — the maximum number of attempts (not modeled
   *                      by `RetryPolicy`, which is per-attempt only).
   * @param sleep         injectable clock; defaults to a real `setTimeout`-backed sleeper.
   */
  constructor(
    private readonly policy: RetryPolicy,
    private readonly isTransient: (error: unknown) => boolean,
    private readonly maxRetryCount: number,
    private readonly sleep: Sleeper = defaultSleep
  ) {}

  /**
   * Legacy adapter: build an {@link ExecutionStrategy} from the public
   * {@link ExecutionStrategyOptions} shape. Maps `maxRetryDelay` onto an
   * {@link ExponentialBackoffRetryPolicy} cap and keeps `maxRetryCount` as the budget,
   * so existing callers (e.g. `DatabaseFacade.createExecutionStrategy`) need no change
   * to their public surface.
   *
   * @deprecated Prefer constructing with an explicit `RetryPolicy`. This adapter exists
   * only to bridge the legacy options shape and should be removed once `orm` is refactored
   * to pass a policy directly.
   */
  static fromOptions(
    opts: ExecutionStrategyOptions,
    isTransient: (error: unknown) => boolean,
    sleep?: Sleeper
  ): ExecutionStrategy {
    return new ExecutionStrategy(
      new ExponentialBackoffRetryPolicy({ maxDelayMs: opts.maxRetryDelay }),
      isTransient,
      opts.maxRetryCount,
      sleep
    );
  }

  /**
   * Execute `operation`, retrying on transient errors until the retry budget
   * (`maxRetryCount`) is exhausted. Each retry waits `policy.getDelayMs(attempt)`
   * milliseconds via the injected sleeper.
   *
   * A retry happens only when the error is transient AND the policy agrees
   * (`policy.shouldRetry(error, attempt, inTransaction)`) AND the budget allows it.
   * Non-transient errors and the final error after budget exhaustion are rethrown
   * immediately (no sleep).
   *
   * @param operation     idempotent async work to execute.
   * @param inTransaction whether the work runs inside a DB transaction; forwarded to
   *                      `policy.shouldRetry` (most policies forbid retrying in a tx).
   * @param signal        optional abort signal, forwarded to the sleeper.
   */
  async executeAsync<T>(
    operation: () => Promise<T>,
    inTransaction = false,
    signal?: AbortSignal
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        attempt++;
        const budgetExhausted = attempt >= this.maxRetryCount;
        const retryable =
          this.isTransient(error) && this.policy.shouldRetry(error, attempt, inTransaction);

        if (budgetExhausted || !retryable) {
          throw error;
        }

        const delayMs = this.policy.getDelayMs?.(attempt) ?? 0;
        await this.sleep(delayMs, signal);
      }
    }
  }
}
