import { describe, expect, it, jest } from '@jest/globals';

import {
  type TransactionCapableProvider,
  TransactionScope
} from '../../src/runner/TransactionScope';

function createTxProvider(): TransactionCapableProvider & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    beginTransaction: jest.fn(async () => {
      calls.push('begin');
    }) as TransactionCapableProvider['beginTransaction'],
    commitTransaction: jest.fn(async () => {
      calls.push('commit');
    }) as TransactionCapableProvider['commitTransaction'],
    rollbackTransaction: jest.fn(async () => {
      calls.push('rollback');
    }) as TransactionCapableProvider['rollbackTransaction']
  };
}

describe('TransactionScope', () => {
  it('runs begin → body → commit on success and returns the body result', async () => {
    const provider = createTxProvider();
    const scope = new TransactionScope(provider);

    const result = await scope.run(async () => {
      provider.calls.push('body');
      return 42;
    });

    expect(result).toBe(42);
    expect(provider.calls).toEqual(['begin', 'body', 'commit']);
    expect(provider.commitTransaction).toHaveBeenCalledTimes(1);
    expect(provider.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('rolls back and rethrows the original error when the body throws', async () => {
    const provider = createTxProvider();
    const scope = new TransactionScope(provider);
    const original = new Error('body failed');

    await expect(
      scope.run(async () => {
        throw original;
      })
    ).rejects.toBe(original);

    expect(provider.calls).toEqual(['begin', 'rollback']);
    expect(provider.commitTransaction).not.toHaveBeenCalled();
  });

  it('surfaces a rollback failure as suppressed without masking the original error', async () => {
    const provider = createTxProvider();
    const rollbackFailure = new Error('rollback failed');
    (provider.rollbackTransaction as jest.Mock).mockImplementation(async () => {
      throw rollbackFailure;
    });
    const scope = new TransactionScope(provider);
    const original = new Error('body failed');

    let caught: unknown;
    try {
      await scope.run(async () => {
        throw original;
      });
    } catch (error) {
      caught = error;
    }

    // The original failure wins …
    expect(caught).toBe(original);
    // … and the rollback failure is preserved as a suppressed entry, not lost.
    expect((caught as { suppressed?: unknown[] }).suppressed).toEqual([rollbackFailure]);
  });
});
