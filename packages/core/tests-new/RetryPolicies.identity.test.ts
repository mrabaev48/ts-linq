import {
  ExponentialBackoffRetryPolicy as ConcExponential,
  FixedIntervalRetryPolicy as ConcFixed,
  NoRetryPolicy as ConcNoRetry
} from '@ts-linq/concurrency';

import {
  ExponentialBackoffRetryPolicy as CoreExponential,
  FixedIntervalRetryPolicy as CoreFixed,
  NoRetryPolicy as CoreNoRetry
} from '../src/utils/RetryPolicies';

// Regression guard for the de-duplication: the retry-policy classes now live in
// a single canonical home (@ts-linq/concurrency) and @ts-linq/core re-exports
// them. The class identity must be shared across both import paths so that
// cross-package `instanceof` holds.
describe('RetryPolicies cross-package identity', () => {
  it('exposes the same class object from core and concurrency', () => {
    expect(CoreExponential).toBe(ConcExponential);
    expect(CoreFixed).toBe(ConcFixed);
    expect(CoreNoRetry).toBe(ConcNoRetry);
  });

  it('an instance created via the core path is instanceof the concurrency class', () => {
    expect(new CoreExponential()).toBeInstanceOf(ConcExponential);
    expect(new CoreFixed(100)).toBeInstanceOf(ConcFixed);
    expect(new CoreNoRetry()).toBeInstanceOf(ConcNoRetry);
  });

  it('an instance created via the concurrency path is instanceof the core class', () => {
    expect(new ConcExponential()).toBeInstanceOf(CoreExponential);
    expect(new ConcFixed(100)).toBeInstanceOf(CoreFixed);
    expect(new ConcNoRetry()).toBeInstanceOf(CoreNoRetry);
  });
});
