import type { RetryPolicy } from '../types';
export interface ExponentialBackoffOptions {
  baseDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
}
/**
 * Exponential backoff retry policy with jitter and basic transient detection.
 * Transient classification can be done by DatabaseProvider; here we retry unless in a transaction.
 */
export declare class ExponentialBackoffRetryPolicy implements RetryPolicy {
  private readonly baseDelayMs;
  private readonly factor;
  private readonly maxDelayMs;
  constructor(options?: ExponentialBackoffOptions);
  shouldRetry(_error: unknown, _attempt: number, inTransaction: boolean): boolean;
  getDelayMs(attempt: number): number;
}
/** No-op retry policy that disables retries entirely. */
export declare class NoRetryPolicy implements RetryPolicy {
  shouldRetry(): boolean;
  getDelayMs(): number;
}
/** Fixed interval retry policy with optional allowance inside transactions. */
export declare class FixedIntervalRetryPolicy implements RetryPolicy {
  private readonly delayMs;
  private readonly allowInTx;
  constructor(delayMs: number, allowInTx?: boolean);
  shouldRetry(_error: unknown, _attempt: number, inTransaction: boolean): boolean;
  getDelayMs(): number;
}
//# sourceMappingURL=RetryPolicies.d.ts.map
