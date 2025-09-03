import { RetryPolicy } from '../types';

export interface ExponentialBackoffOptions {
  baseDelayMs?: number; // default 50
  factor?: number; // default 2
  maxDelayMs?: number; // default 2000
}

/**
 * Exponential backoff retry policy with jitter and basic transient detection.
 * Transient classification can be done by DatabaseProvider; here we retry unless in a transaction.
 */
export class ExponentialBackoffRetryPolicy implements RetryPolicy {
  private readonly baseDelayMs: number;
  private readonly factor: number;
  private readonly maxDelayMs: number;

  constructor(options?: ExponentialBackoffOptions) {
    this.baseDelayMs = options?.baseDelayMs ?? 50;
    this.factor = options?.factor ?? 2;
    this.maxDelayMs = options?.maxDelayMs ?? 2000;
  }

  public shouldRetry(_error: unknown, _attempt: number, inTransaction: boolean): boolean {
    // Delegate transient detection to provider; here just forbid retries in transactions
    return !inTransaction;
  }

  public getDelayMs(attempt: number): number {
    const jitter = Math.floor(Math.random() * Math.min(25, this.baseDelayMs));
    const v = this.baseDelayMs * Math.pow(this.factor, Math.max(0, attempt - 1)) + jitter;
    return Math.min(this.maxDelayMs, v);
  }
}

/** No-op retry policy that disables retries entirely. */
export class NoRetryPolicy implements RetryPolicy {
  public shouldRetry(): boolean {
    return false;
  }
  public getDelayMs(): number {
    return 0;
  }
}

/** Fixed interval retry policy with optional allowance inside transactions. */
export class FixedIntervalRetryPolicy implements RetryPolicy {
  private readonly delayMs: number;
  private readonly allowInTx: boolean;
  constructor(delayMs: number, allowInTx: boolean = false) {
    this.delayMs = Math.max(0, delayMs);
    this.allowInTx = allowInTx;
  }
  public shouldRetry(_error: unknown, _attempt: number, inTransaction: boolean): boolean {
    return this.allowInTx ? true : !inTransaction;
  }
  public getDelayMs(): number {
    return this.delayMs;
  }
}


