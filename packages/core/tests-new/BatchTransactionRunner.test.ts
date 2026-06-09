import { describe, expect, it } from '@jest/globals';

import type { BatchTransactionPort } from '../src/batch/BatchTransactionRunner';
import { BatchTransactionRunner } from '../src/batch/BatchTransactionRunner';

function recordingPort(): BatchTransactionPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    beginTransaction: async () => void calls.push('begin'),
    commitTransaction: async () => void calls.push('commit'),
    rollbackTransaction: async () => void calls.push('rollback')
  };
}

describe('BatchTransactionRunner', () => {
  it('runs every entity then commits', async () => {
    const port = recordingPort();
    const ops: number[] = [];
    const runner = new BatchTransactionRunner(port);

    const result = await runner.runAll([1, 2, 3], async (e) => void ops.push(e));

    expect(result).toEqual([1, 2, 3]);
    expect(ops).toEqual([1, 2, 3]);
    expect(port.calls).toEqual(['begin', 'commit']);
  });

  it('is a no-op for an empty batch (no transaction opened)', async () => {
    const port = recordingPort();
    const runner = new BatchTransactionRunner(port);

    const result = await runner.runAll([], async () => {});

    expect(result).toEqual([]);
    expect(port.calls).toEqual([]);
  });

  it('rolls back and rethrows when an operation fails', async () => {
    const port = recordingPort();
    const runner = new BatchTransactionRunner(port);
    const boom = new Error('op failed');

    await expect(
      runner.runAll([1, 2], async (e) => {
        if (e === 2) throw boom;
      })
    ).rejects.toBe(boom);

    expect(port.calls).toEqual(['begin', 'rollback']);
  });
});
