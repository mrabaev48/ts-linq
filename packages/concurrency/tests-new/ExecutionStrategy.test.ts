import { describe, expect, it, jest } from '@jest/globals';

import { ExecutionStrategy } from '../src/ExecutionStrategy';

describe('ExecutionStrategy', () => {
  const alwaysTransient = () => true;
  const neverTransient = () => false;

  it('returns the result on the first attempt', async () => {
    const strategy = new ExecutionStrategy(
      { maxRetryCount: 3, maxRetryDelay: 100 },
      alwaysTransient
    );
    const result = await strategy.executeAsync(async () => 'success');
    expect(result).toBe('success');
  });

  it('retries on transient error and succeeds on second attempt', async () => {
    let calls = 0;
    const strategy = new ExecutionStrategy(
      { maxRetryCount: 3, maxRetryDelay: 100 },
      alwaysTransient
    );
    const result = await strategy.executeAsync(async () => {
      calls++;
      if (calls === 1) throw new Error('transient');
      return 'recovered';
    });
    expect(result).toBe('recovered');
    expect(calls).toBe(2);
  });

  it('exhausts retry budget and rethrows', async () => {
    const strategy = new ExecutionStrategy(
      { maxRetryCount: 3, maxRetryDelay: 100 },
      alwaysTransient
    );
    let calls = 0;
    await expect(
      strategy.executeAsync(async () => {
        calls++;
        throw new Error('always fails');
      })
    ).rejects.toThrow('always fails');
    expect(calls).toBe(3);
  });

  it('does NOT retry on non-transient errors', async () => {
    const strategy = new ExecutionStrategy(
      { maxRetryCount: 5, maxRetryDelay: 100 },
      neverTransient
    );
    let calls = 0;
    await expect(
      strategy.executeAsync(async () => {
        calls++;
        throw new Error('non-transient');
      })
    ).rejects.toThrow('non-transient');
    expect(calls).toBe(1);
  });

  it('uses the transient checker to distinguish error types', async () => {
    const isTransient = jest.fn((e: unknown) => (e as Error).message === 'deadlock');
    const strategy = new ExecutionStrategy({ maxRetryCount: 3, maxRetryDelay: 100 }, isTransient);
    let calls = 0;

    // First call: deadlock (transient) → retried; second call: success
    const result = await strategy.executeAsync(async () => {
      calls++;
      if (calls === 1) throw new Error('deadlock');
      return 42;
    });

    expect(result).toBe(42);
    expect(calls).toBe(2);
    expect(isTransient).toHaveBeenCalled();
  });

  it('propagates the correct error after budget exhaustion', async () => {
    const strategy = new ExecutionStrategy(
      { maxRetryCount: 2, maxRetryDelay: 100 },
      alwaysTransient
    );
    const sentinel = new Error('sentinel-error');
    await expect(
      strategy.executeAsync(async () => {
        throw sentinel;
      })
    ).rejects.toBe(sentinel);
  });

  it('respects maxRetryCount boundary — maxRetryCount=1 means zero retries', async () => {
    const strategy = new ExecutionStrategy(
      { maxRetryCount: 1, maxRetryDelay: 100 },
      alwaysTransient
    );
    let calls = 0;
    await expect(
      strategy.executeAsync(async () => {
        calls++;
        throw new Error('fail');
      })
    ).rejects.toThrow('fail');
    expect(calls).toBe(1);
  });

  it('resolves with undefined when operation returns void', async () => {
    const strategy = new ExecutionStrategy(
      { maxRetryCount: 3, maxRetryDelay: 100 },
      alwaysTransient
    );
    const result = await strategy.executeAsync(async () => {});
    expect(result).toBeUndefined();
  });
});
