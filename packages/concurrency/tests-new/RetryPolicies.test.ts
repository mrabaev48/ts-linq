import { describe, expect, it } from '@jest/globals';

import {
  ExponentialBackoffRetryPolicy,
  FixedIntervalRetryPolicy,
  NoRetryPolicy
} from '../src/RetryPolicies';

describe('ExponentialBackoffRetryPolicy', () => {
  describe('shouldRetry()', () => {
    it('should allow retry when not in transaction', () => {
      const policy = new ExponentialBackoffRetryPolicy();

      const shouldRetry = policy.shouldRetry(new Error('test'), 1, false);

      expect(shouldRetry).toBe(true);
    });

    it('should forbid retry when in transaction', () => {
      const policy = new ExponentialBackoffRetryPolicy();

      const shouldRetry = policy.shouldRetry(new Error('test'), 1, true);

      expect(shouldRetry).toBe(false);
    });

    it('should forbid retry on any attempt number when in transaction', () => {
      const policy = new ExponentialBackoffRetryPolicy();

      expect(policy.shouldRetry(new Error('test'), 1, true)).toBe(false);
      expect(policy.shouldRetry(new Error('test'), 5, true)).toBe(false);
      expect(policy.shouldRetry(new Error('test'), 100, true)).toBe(false);
    });
  });

  describe('getDelayMs()', () => {
    it('should return delay with exponential backoff', () => {
      const policy = new ExponentialBackoffRetryPolicy({
        baseDelayMs: 100,
        factor: 2,
        maxDelayMs: 2000
      });

      const delay1 = policy.getDelayMs(1);
      const delay2 = policy.getDelayMs(2);
      const delay3 = policy.getDelayMs(3);

      expect(delay1).toBeGreaterThan(0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should respect maxDelayMs cap', () => {
      const policy = new ExponentialBackoffRetryPolicy({
        baseDelayMs: 100,
        factor: 2,
        maxDelayMs: 500
      });

      for (let attempt = 1; attempt <= 20; attempt++) {
        const delay = policy.getDelayMs(attempt);
        expect(delay).toBeLessThanOrEqual(500);
      }
    });

    it('should add jitter to prevent thundering herd', () => {
      const policy = new ExponentialBackoffRetryPolicy({
        baseDelayMs: 100,
        factor: 2
      });

      const delays = Array.from({ length: 10 }, () => policy.getDelayMs(5));
      const uniqueDelays = new Set(delays);

      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it('should use default options when not provided', () => {
      const policy = new ExponentialBackoffRetryPolicy();

      const delay1 = policy.getDelayMs(1);
      const delay2 = policy.getDelayMs(2);

      expect(delay1).toBeGreaterThan(0);
      expect(delay1).toBeLessThan(100);
      expect(delay2).toBeGreaterThan(delay1);
    });

    it('should handle attempt = 0 gracefully', () => {
      const policy = new ExponentialBackoffRetryPolicy();

      const delay = policy.getDelayMs(0);

      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(100);
    });

    it('should handle negative attempt gracefully', () => {
      const policy = new ExponentialBackoffRetryPolicy();

      const delay = policy.getDelayMs(-1);

      expect(delay).toBeGreaterThanOrEqual(0);
    });

    it('should cap jitter at 25ms or baseDelayMs whichever is smaller', () => {
      const policy = new ExponentialBackoffRetryPolicy({ baseDelayMs: 10 });

      const delays = Array.from({ length: 100 }, () => policy.getDelayMs(1));
      const maxDelay = Math.max(...delays);

      expect(maxDelay).toBeLessThan(40);
    });
  });

  describe('constructor options', () => {
    it('should accept custom baseDelayMs', () => {
      const policy = new ExponentialBackoffRetryPolicy({ baseDelayMs: 200 });

      const delay = policy.getDelayMs(1);

      expect(delay).toBeGreaterThan(100);
    });

    it('should accept custom factor', () => {
      const policy = new ExponentialBackoffRetryPolicy({
        baseDelayMs: 100,
        factor: 3
      });

      const delay1 = policy.getDelayMs(1);
      const delay2 = policy.getDelayMs(2);

      const ratio = delay2 / delay1;
      expect(ratio).toBeGreaterThan(2);
    });

    it('should accept custom maxDelayMs', () => {
      const policy = new ExponentialBackoffRetryPolicy({
        baseDelayMs: 100,
        factor: 2,
        maxDelayMs: 300
      });

      const delay = policy.getDelayMs(10);

      expect(delay).toBeLessThanOrEqual(300);
    });
  });
});

describe('NoRetryPolicy', () => {
  describe('shouldRetry()', () => {
    it('should always return false', () => {
      const policy = new NoRetryPolicy();

      expect(policy.shouldRetry()).toBe(false);
    });
  });

  describe('getDelayMs()', () => {
    it('should always return 0', () => {
      const policy = new NoRetryPolicy();

      expect(policy.getDelayMs()).toBe(0);
    });
  });
});

describe('FixedIntervalRetryPolicy', () => {
  describe('shouldRetry()', () => {
    it('should allow retry when not in transaction', () => {
      const policy = new FixedIntervalRetryPolicy(100);

      const shouldRetry = policy.shouldRetry(new Error('test'), 1, false);

      expect(shouldRetry).toBe(true);
    });

    it('should forbid retry when in transaction by default', () => {
      const policy = new FixedIntervalRetryPolicy(100);

      const shouldRetry = policy.shouldRetry(new Error('test'), 1, true);

      expect(shouldRetry).toBe(false);
    });

    it('should allow retry in transaction when allowInTx is true', () => {
      const policy = new FixedIntervalRetryPolicy(100, true);

      const shouldRetry = policy.shouldRetry(new Error('test'), 1, true);

      expect(shouldRetry).toBe(true);
    });

    it('should always retry when allowInTx is true regardless of transaction state', () => {
      const policy = new FixedIntervalRetryPolicy(100, true);

      expect(policy.shouldRetry(new Error('test'), 1, false)).toBe(true);
      expect(policy.shouldRetry(new Error('test'), 5, true)).toBe(true);
      expect(policy.shouldRetry(null, 100, false)).toBe(true);
    });
  });

  describe('getDelayMs()', () => {
    it('should return fixed delay', () => {
      const policy = new FixedIntervalRetryPolicy(500);

      expect(policy.getDelayMs()).toBe(500);
    });

    it('should handle zero delay', () => {
      const policy = new FixedIntervalRetryPolicy(0);

      expect(policy.getDelayMs()).toBe(0);
    });

    it('should handle negative delay by returning zero', () => {
      const policy = new FixedIntervalRetryPolicy(-100);

      expect(policy.getDelayMs()).toBe(0);
    });

    it('should support very large delays', () => {
      const policy = new FixedIntervalRetryPolicy(60000);

      expect(policy.getDelayMs()).toBe(60000);
    });
  });

  describe('constructor parameters', () => {
    it('should accept delay only', () => {
      const policy = new FixedIntervalRetryPolicy(250);

      expect(policy.getDelayMs()).toBe(250);
      expect(policy.shouldRetry(new Error('test'), 1, true)).toBe(false);
    });

    it('should accept delay and allowInTx', () => {
      const policy = new FixedIntervalRetryPolicy(250, true);

      expect(policy.getDelayMs()).toBe(250);
      expect(policy.shouldRetry(new Error('test'), 1, true)).toBe(true);
    });
  });
});
