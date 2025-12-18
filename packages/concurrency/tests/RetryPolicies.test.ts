import { 
  ExponentialBackoffRetryPolicy, 
  NoRetryPolicy, 
  FixedIntervalRetryPolicy 
} from '../src/RetryPolicies';

describe('ExponentialBackoffRetryPolicy', () => {
  describe('Constructor', () => {
    it('should create with default options', () => {
      const policy = new ExponentialBackoffRetryPolicy();
      expect(policy).toBeDefined();
    });

    it('should create with custom options', () => {
      const policy = new ExponentialBackoffRetryPolicy({
        baseDelayMs: 100,
        factor: 3,
        maxDelayMs: 5000
      });
      expect(policy).toBeDefined();
    });

    it('should create with partial options', () => {
      const policy = new ExponentialBackoffRetryPolicy({ baseDelayMs: 25 });
      expect(policy).toBeDefined();
    });
  });

  describe('shouldRetry()', () => {
    let policy: ExponentialBackoffRetryPolicy;

    beforeEach(() => {
      policy = new ExponentialBackoffRetryPolicy();
    });

    it('should return true when not in transaction', () => {
      const result = policy.shouldRetry(new Error('transient'), 1, false);
      expect(result).toBe(true);
    });

    it('should return false when in transaction', () => {
      const result = policy.shouldRetry(new Error('transient'), 1, true);
      expect(result).toBe(false);
    });

    it('should return true for any error outside transaction', () => {
      expect(policy.shouldRetry(new Error('connection reset'), 1, false)).toBe(true);
      expect(policy.shouldRetry(new Error('timeout'), 2, false)).toBe(true);
      expect(policy.shouldRetry({ code: 'ECONNRESET' }, 3, false)).toBe(true);
    });
  });

  describe('getDelayMs()', () => {
    it('should return delay within expected range for attempt 1', () => {
      const policy = new ExponentialBackoffRetryPolicy({ baseDelayMs: 50, factor: 2 });
      const delay = policy.getDelayMs(1);
      
      expect(delay).toBeGreaterThanOrEqual(50);
      expect(delay).toBeLessThanOrEqual(100);
    });

    it('should increase delay exponentially', () => {
      const policy = new ExponentialBackoffRetryPolicy({ 
        baseDelayMs: 100, 
        factor: 2, 
        maxDelayMs: 10000 
      });
      
      const delay1 = policy.getDelayMs(1);
      const delay2 = policy.getDelayMs(2);
      const delay3 = policy.getDelayMs(3);
      
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should not exceed max delay', () => {
      const policy = new ExponentialBackoffRetryPolicy({ 
        baseDelayMs: 100, 
        factor: 10, 
        maxDelayMs: 500 
      });
      
      const delay = policy.getDelayMs(10);
      expect(delay).toBeLessThanOrEqual(500);
    });

    it('should handle attempt 0', () => {
      const policy = new ExponentialBackoffRetryPolicy({ baseDelayMs: 50 });
      const delay = policy.getDelayMs(0);
      
      expect(delay).toBeGreaterThanOrEqual(50);
    });
  });
});

describe('NoRetryPolicy', () => {
  let policy: NoRetryPolicy;

  beforeEach(() => {
    policy = new NoRetryPolicy();
  });

  describe('shouldRetry()', () => {
    it('should always return false', () => {
      expect((policy as any).shouldRetry()).toBe(false);
    });

    it('should return false when called with arguments', () => {
      expect((policy as any).shouldRetry(new Error('test'), 1, false)).toBe(false);
    });
  });

  describe('getDelayMs()', () => {
    it('should always return 0', () => {
      expect((policy as any).getDelayMs()).toBe(0);
    });
  });
});

describe('FixedIntervalRetryPolicy', () => {
  describe('Constructor', () => {
    it('should create with delay', () => {
      const policy = new FixedIntervalRetryPolicy(100);
      expect(policy).toBeDefined();
    });

    it('should create with allowInTx option', () => {
      const policy = new FixedIntervalRetryPolicy(100, true);
      expect(policy).toBeDefined();
    });

    it('should handle negative delay as 0', () => {
      const policy = new FixedIntervalRetryPolicy(-50);
      expect(policy.getDelayMs()).toBe(0);
    });
  });

  describe('shouldRetry()', () => {
    it('should return true when not in transaction (default)', () => {
      const policy = new FixedIntervalRetryPolicy(100);
      expect(policy.shouldRetry(new Error('test'), 1, false)).toBe(true);
    });

    it('should return false when in transaction (default)', () => {
      const policy = new FixedIntervalRetryPolicy(100);
      expect(policy.shouldRetry(new Error('test'), 1, true)).toBe(false);
    });

    it('should return true when in transaction if allowInTx is true', () => {
      const policy = new FixedIntervalRetryPolicy(100, true);
      expect(policy.shouldRetry(new Error('test'), 1, true)).toBe(true);
    });

    it('should return true outside transaction regardless of allowInTx', () => {
      const policy1 = new FixedIntervalRetryPolicy(100, false);
      const policy2 = new FixedIntervalRetryPolicy(100, true);
      
      expect(policy1.shouldRetry(new Error('test'), 1, false)).toBe(true);
      expect(policy2.shouldRetry(new Error('test'), 1, false)).toBe(true);
    });
  });

  describe('getDelayMs()', () => {
    it('should return fixed delay', () => {
      const policy = new FixedIntervalRetryPolicy(250);
      
      expect((policy as any).getDelayMs()).toBe(250);
    });

    it('should return 0 for negative delay', () => {
      const policy = new FixedIntervalRetryPolicy(-100);
      expect((policy as any).getDelayMs()).toBe(0);
    });
  });
});
