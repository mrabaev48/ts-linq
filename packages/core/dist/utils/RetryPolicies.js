'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.FixedIntervalRetryPolicy =
  exports.NoRetryPolicy =
  exports.ExponentialBackoffRetryPolicy =
    void 0;
/**
 * Exponential backoff retry policy with jitter and basic transient detection.
 * Transient classification can be done by DatabaseProvider; here we retry unless in a transaction.
 */
class ExponentialBackoffRetryPolicy {
  constructor(options) {
    this.baseDelayMs = options?.baseDelayMs ?? 50;
    this.factor = options?.factor ?? 2;
    this.maxDelayMs = options?.maxDelayMs ?? 2000;
  }
  shouldRetry(_error, _attempt, inTransaction) {
    // Delegate transient detection to provider; here just forbid retries in transactions
    return !inTransaction;
  }
  getDelayMs(attempt) {
    const jitterMs = Math.floor(Math.random() * Math.min(25, this.baseDelayMs));
    const computedDelayMs =
      this.baseDelayMs * Math.pow(this.factor, Math.max(0, attempt - 1)) + jitterMs;
    return Math.min(this.maxDelayMs, computedDelayMs);
  }
}
exports.ExponentialBackoffRetryPolicy = ExponentialBackoffRetryPolicy;
/** No-op retry policy that disables retries entirely. */
class NoRetryPolicy {
  shouldRetry() {
    return false;
  }
  getDelayMs() {
    return 0;
  }
}
exports.NoRetryPolicy = NoRetryPolicy;
/** Fixed interval retry policy with optional allowance inside transactions. */
class FixedIntervalRetryPolicy {
  constructor(delayMs, allowInTx = false) {
    this.delayMs = Math.max(0, delayMs);
    this.allowInTx = allowInTx;
  }
  shouldRetry(_error, _attempt, inTransaction) {
    return this.allowInTx ? true : !inTransaction;
  }
  getDelayMs() {
    return this.delayMs;
  }
}
exports.FixedIntervalRetryPolicy = FixedIntervalRetryPolicy;
//# sourceMappingURL=RetryPolicies.js.map
