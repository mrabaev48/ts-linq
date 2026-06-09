import { describe, expect, it, jest } from '@jest/globals';
import type { RetryPolicy } from '@ts-linq/types';

import { ExecutionStrategy, type Sleeper } from '../src/ExecutionStrategy';
import { ExponentialBackoffRetryPolicy, FixedIntervalRetryPolicy } from '../src/RetryPolicies';

const alwaysTransient = () => true;
const neverTransient = () => false;

/** A stub sleeper that records its calls and resolves immediately (no real waits). */
const createStubSleeper = (): jest.MockedFunction<Sleeper> =>
  jest.fn<Sleeper>().mockResolvedValue(undefined);

/** Deterministic policy with a fixed delay schedule (no jitter) for schedule assertions. */
const fixedDelayPolicy = (delayMs: number, allowInTx = false): RetryPolicy =>
  new FixedIntervalRetryPolicy(delayMs, allowInTx);

describe('ExecutionStrategy — core retry behavior', () => {
  it('returns the result on the first attempt without sleeping', async () => {
    const sleep = createStubSleeper();
    const strategy = new ExecutionStrategy(fixedDelayPolicy(10), alwaysTransient, 3, sleep);

    const result = await strategy.executeAsync(async () => 'success');

    expect(result).toBe('success');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries on transient error and succeeds on a later attempt', async () => {
    const sleep = createStubSleeper();
    const strategy = new ExecutionStrategy(fixedDelayPolicy(10), alwaysTransient, 3, sleep);
    let calls = 0;

    const result = await strategy.executeAsync(async () => {
      calls++;
      if (calls === 1) throw new Error('transient');
      return 'recovered';
    });

    expect(result).toBe('recovered');
    expect(calls).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(10, undefined);
  });

  it('exhausts the retry budget and rethrows after maxRetryCount attempts', async () => {
    const sleep = createStubSleeper();
    const strategy = new ExecutionStrategy(fixedDelayPolicy(10), alwaysTransient, 3, sleep);
    let calls = 0;

    await expect(
      strategy.executeAsync(async () => {
        calls++;
        throw new Error('always fails');
      })
    ).rejects.toThrow('always fails');

    expect(calls).toBe(3);
    // maxRetryCount=3 → 3 attempts, 2 sleeps (no sleep before the final rethrow).
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry or sleep on non-transient errors', async () => {
    const sleep = createStubSleeper();
    const strategy = new ExecutionStrategy(fixedDelayPolicy(10), neverTransient, 5, sleep);
    let calls = 0;

    await expect(
      strategy.executeAsync(async () => {
        calls++;
        throw new Error('non-transient');
      })
    ).rejects.toThrow('non-transient');

    expect(calls).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('uses the transient checker to distinguish error types', async () => {
    const sleep = createStubSleeper();
    const isTransient = jest.fn((e: unknown) => (e as Error).message === 'deadlock');
    const strategy = new ExecutionStrategy(fixedDelayPolicy(10), isTransient, 3, sleep);
    let calls = 0;

    const result = await strategy.executeAsync(async () => {
      calls++;
      if (calls === 1) throw new Error('deadlock');
      return 42;
    });

    expect(result).toBe(42);
    expect(calls).toBe(2);
    expect(isTransient).toHaveBeenCalled();
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('propagates the exact last error after budget exhaustion', async () => {
    const sleep = createStubSleeper();
    const strategy = new ExecutionStrategy(fixedDelayPolicy(10), alwaysTransient, 2, sleep);
    const sentinel = new Error('sentinel-error');

    await expect(
      strategy.executeAsync(async () => {
        throw sentinel;
      })
    ).rejects.toBe(sentinel);
  });

  it('respects the budget boundary — maxRetryCount=1 means zero retries and no sleep', async () => {
    const sleep = createStubSleeper();
    const strategy = new ExecutionStrategy(fixedDelayPolicy(10), alwaysTransient, 1, sleep);
    let calls = 0;

    await expect(
      strategy.executeAsync(async () => {
        calls++;
        throw new Error('fail');
      })
    ).rejects.toThrow('fail');

    expect(calls).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('resolves with undefined when the operation returns void', async () => {
    const sleep = createStubSleeper();
    const strategy = new ExecutionStrategy(fixedDelayPolicy(10), alwaysTransient, 3, sleep);

    const result = await strategy.executeAsync(async () => {});

    expect(result).toBeUndefined();
  });
});

describe('ExecutionStrategy — backoff schedule, transactions & abort', () => {
  it('sleeps with the exact delay schedule produced by the policy', async () => {
    const sleep = createStubSleeper();
    // Deterministic, increasing schedule so the sequence is verifiable.
    const policy: RetryPolicy = {
      shouldRetry: () => true,
      getDelayMs: (attempt: number) => attempt * 100
    };
    const strategy = new ExecutionStrategy(policy, alwaysTransient, 4, sleep);
    let calls = 0;

    await expect(
      strategy.executeAsync(async () => {
        calls++;
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(calls).toBe(4);
    // 4 attempts → 3 sleeps, with delays getDelayMs(1..3).
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200, 300]);
  });

  it('treats a missing getDelayMs as a zero delay', async () => {
    const sleep = createStubSleeper();
    const policy: RetryPolicy = { shouldRetry: () => true };
    const strategy = new ExecutionStrategy(policy, alwaysTransient, 2, sleep);

    await expect(
      strategy.executeAsync(async () => {
        throw new Error('no-delay');
      })
    ).rejects.toThrow('no-delay');

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(0, undefined);
  });

  it('forwards inTransaction to the policy and does not retry when the policy forbids it', async () => {
    const sleep = createStubSleeper();
    const shouldRetry = jest.fn((_e: unknown, _attempt: number, inTransaction?: boolean) =>
      inTransaction === true ? false : true
    );
    const policy: RetryPolicy = { shouldRetry, getDelayMs: () => 10 };
    const strategy = new ExecutionStrategy(policy, alwaysTransient, 5, sleep);
    let calls = 0;

    await expect(
      strategy.executeAsync(async () => {
        calls++;
        throw new Error('in-tx');
      }, /* inTransaction */ true)
    ).rejects.toThrow('in-tx');

    expect(calls).toBe(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1, true);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does not retry inside a transaction with the default ExponentialBackoffRetryPolicy', async () => {
    const sleep = createStubSleeper();
    const strategy = new ExecutionStrategy(
      new ExponentialBackoffRetryPolicy(),
      alwaysTransient,
      5,
      sleep
    );
    let calls = 0;

    await expect(
      strategy.executeAsync(async () => {
        calls++;
        throw new Error('tx-bound');
      }, true)
    ).rejects.toThrow('tx-bound');

    expect(calls).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('passes the abort signal through to the sleeper', async () => {
    const sleep = createStubSleeper();
    const controller = new AbortController();
    const strategy = new ExecutionStrategy(fixedDelayPolicy(10), alwaysTransient, 3, sleep);
    let calls = 0;

    await strategy.executeAsync(
      async () => {
        calls++;
        if (calls === 1) throw new Error('transient');
        return 'ok';
      },
      false,
      controller.signal
    );

    expect(sleep).toHaveBeenCalledWith(10, controller.signal);
  });
});

describe('ExecutionStrategy.fromOptions legacy adapter', () => {
  it('maps maxRetryCount onto the budget and retries deterministically with a stub sleeper', async () => {
    const sleep = createStubSleeper();
    const strategy = ExecutionStrategy.fromOptions(
      { maxRetryCount: 3, maxRetryDelay: 1000 },
      alwaysTransient,
      sleep
    );
    let calls = 0;

    await expect(
      strategy.executeAsync(async () => {
        calls++;
        throw new Error('legacy-fail');
      })
    ).rejects.toThrow('legacy-fail');

    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('caps the backoff delay at maxRetryDelay (mapped to the policy)', async () => {
    const sleep = createStubSleeper();
    const strategy = ExecutionStrategy.fromOptions(
      { maxRetryCount: 5, maxRetryDelay: 100 },
      alwaysTransient,
      sleep
    );

    await expect(
      strategy.executeAsync(async () => {
        throw new Error('cap');
      })
    ).rejects.toThrow('cap');

    for (const [delayMs] of sleep.mock.calls) {
      expect(delayMs).toBeLessThanOrEqual(100);
    }
  });

  it('succeeds on the first attempt without sleeping', async () => {
    const sleep = createStubSleeper();
    const strategy = ExecutionStrategy.fromOptions(
      { maxRetryCount: 3, maxRetryDelay: 100 },
      alwaysTransient,
      sleep
    );

    const result = await strategy.executeAsync(async () => 'success');

    expect(result).toBe('success');
    expect(sleep).not.toHaveBeenCalled();
  });
});
