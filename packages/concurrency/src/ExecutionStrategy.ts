import type { ExecutionStrategyOptions } from '@ts-linq/types';

export type { ExecutionStrategyOptions };

/**
 * Wraps a user-supplied async block in a retry loop with configurable backoff.
 * Mirrors EF Core's `IExecutionStrategy.ExecuteAsync`.
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
  constructor(
    private readonly opts: ExecutionStrategyOptions,
    private readonly isTransient: (error: unknown) => boolean
  ) {}

  /**
   * Execute `operation` and retry on transient errors up to `maxRetryCount` times
   * with exponential backoff capped at `maxRetryDelay` milliseconds.
   */
  async executeAsync<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        attempt++;
        const budgetExhausted = attempt >= this.opts.maxRetryCount;
        const nonTransient = !this.isTransient(error);

        if (budgetExhausted || nonTransient) {
          throw error;
        }

        const delayMs = Math.min(Math.pow(2, attempt - 1) * 1000, this.opts.maxRetryDelay);

        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
