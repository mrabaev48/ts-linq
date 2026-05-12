import { ExponentialBackoffRetryPolicy, FixedIntervalRetryPolicy, NoRetryPolicy } from '../src/utils/RetryPolicies';

describe('RetryPolicies', () => {
  describe('FixedIntervalRetryPolicy', () => {
    it('should create with default delay', () => {
      const policy = new FixedIntervalRetryPolicy(100);

      expect(policy.getDelayMs()).toBe(100);
    });

    it('should return same delay for all attempts', () => {
      const policy = new FixedIntervalRetryPolicy(50);

      expect(policy.getDelayMs()).toBe(50);
      expect(policy.getDelayMs()).toBe(50);
      expect(policy.getDelayMs()).toBe(50);
    });

    it('should not retry when in transaction by default', () => {
      const policy = new FixedIntervalRetryPolicy(100);

      expect(policy.shouldRetry(new Error(), 1, true)).toBe(false);
    });

    it('should retry when not in transaction by default', () => {
      const policy = new FixedIntervalRetryPolicy(100);

      expect(policy.shouldRetry(new Error(), 1, false)).toBe(true);
    });

    it('should allow retry in transaction when allowInTx is true', () => {
      const policy = new FixedIntervalRetryPolicy(100, true);

      expect(policy.shouldRetry(new Error(), 1, true)).toBe(true);
    });

    it('should handle zero delay', () => {
      const policy = new FixedIntervalRetryPolicy(0);

      expect(policy.getDelayMs()).toBe(0);
    });

    it('should handle negative delay as zero', () => {
      const policy = new FixedIntervalRetryPolicy(-100);

      expect(policy.getDelayMs()).toBe(0);
    });
  });

  describe('ExponentialBackoffRetryPolicy', () => {
    it('should create with default options', () => {
      const policy = new ExponentialBackoffRetryPolicy();

      expect(policy).toBeInstanceOf(ExponentialBackoffRetryPolicy);
    });

    it('should create with custom baseDelayMs', () => {
      const policy = new ExponentialBackoffRetryPolicy({ baseDelayMs: 200 });

      const delay = policy.getDelayMs(1);
      expect(delay).toBeGreaterThanOrEqual(200);
    });

    it('should calculate exponential delay', () => {
      const policy = new ExponentialBackoffRetryPolicy({ baseDelayMs: 100, maxDelayMs: 10000 });

      const delay1 = policy.getDelayMs(1);
      const delay2 = policy.getDelayMs(2);
      const delay3 = policy.getDelayMs(3);

      expect(delay1).toBeGreaterThan(0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should cap delay at maxDelayMs', () => {
      const policy = new ExponentialBackoffRetryPolicy({ baseDelayMs: 100, maxDelayMs: 500 });

      const delay = policy.getDelayMs(10);

      expect(delay).toBeLessThanOrEqual(500);
    });

    it('should include jitter within expected range', () => {
      const policy = new ExponentialBackoffRetryPolicy({ baseDelayMs: 100, factor: 2 });

      const delay = policy.getDelayMs(2);

      const expectedBase = 100 * Math.pow(2, 1);
      expect(delay).toBeGreaterThanOrEqual(expectedBase);
      expect(delay).toBeLessThan(expectedBase + 100);
    });

    it('should not retry when in transaction', () => {
      const policy = new ExponentialBackoffRetryPolicy();

      expect(policy.shouldRetry(new Error(), 1, true)).toBe(false);
    });

    it('should retry when not in transaction', () => {
      const policy = new ExponentialBackoffRetryPolicy();

      expect(policy.shouldRetry(new Error(), 1, false)).toBe(true);
    });
  });

  describe('NoRetryPolicy', () => {
    it('should never retry', () => {
      const policy = new NoRetryPolicy();

      expect(policy.shouldRetry()).toBe(false);
      expect(policy.shouldRetry()).toBe(false);
    });

    it('should return zero delay', () => {
      const policy = new NoRetryPolicy();

      expect(policy.getDelayMs()).toBe(0);
    });
  });
});
