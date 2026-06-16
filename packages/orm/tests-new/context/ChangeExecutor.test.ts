/**
 * Isolated unit tests for ChangeExecutor (refactor orm/task-1).
 * Per-row DML dispatch, SP routing, and skip-navigation writes with mocks.
 */
import { describe, expect, it, jest } from '@jest/globals';

import { ChangeExecutor } from '../../src/context/ChangeExecutor';
import type { DbContextServices } from '../../src/context/DbContextServices';

class Widget {}

function makeServices(opts: { hasSp?: boolean; maxBatchSize?: number } = {}) {
  const insertCmd = { execute: jest.fn(async () => undefined) };
  const updateCmd = { execute: jest.fn(async () => undefined) };
  const deleteCmd = { execute: jest.fn(async () => true) };
  const spExecutor = {
    hasSp: jest.fn(() => opts.hasSp ?? false),
    executeInsert: jest.fn(async () => undefined),
    executeUpdate: jest.fn(async () => 1),
    executeDelete: jest.fn(async () => 1)
  };
  const provider = {
    insert: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined)
  };
  const services = {
    provider,
    registry: { getEntity: jest.fn(() => ({ tableFragments: undefined })) },
    changeTracker: { getShadowValues: jest.fn(() => new Map()) },
    insertCmd,
    updateCmd,
    deleteCmd,
    fragmentExecutor: {},
    spExecutor,
    maxBatchSize: opts.maxBatchSize ?? 0
  } as unknown as DbContextServices;
  return { services, insertCmd, updateCmd, deleteCmd, spExecutor, provider };
}

describe('ChangeExecutor.executeChanges (per-row path)', () => {
  it('routes an added change to the insert command and returns 1', async () => {
    const m = makeServices();
    const n = await new ChangeExecutor(m.services).executeChanges([
      { entity: new Widget(), entityClass: Widget, state: 'added' }
    ]);
    expect(n).toBe(1);
    expect(m.insertCmd.execute).toHaveBeenCalledTimes(1);
  });

  it('routes a modified change to the update command and returns 1', async () => {
    const m = makeServices();
    const n = await new ChangeExecutor(m.services).executeChanges([
      { entity: new Widget(), entityClass: Widget, state: 'modified' }
    ]);
    expect(n).toBe(1);
    expect(m.updateCmd.execute).toHaveBeenCalledTimes(1);
  });

  it('routes a deleted change to the delete command (1 when a row is removed)', async () => {
    const m = makeServices();
    const n = await new ChangeExecutor(m.services).executeChanges([
      { entity: new Widget(), entityClass: Widget, state: 'deleted' }
    ]);
    expect(n).toBe(1);
    expect(m.deleteCmd.execute).toHaveBeenCalledTimes(1);
  });

  it('routes to the stored procedure executor when an SP is configured', async () => {
    const m = makeServices({ hasSp: true });
    await new ChangeExecutor(m.services).executeChanges([
      { entity: new Widget(), entityClass: Widget, state: 'added' }
    ]);
    expect(m.spExecutor.executeInsert).toHaveBeenCalledTimes(1);
    expect(m.insertCmd.execute).not.toHaveBeenCalled();
  });

  it('sums affected rows across a mixed change set', async () => {
    const m = makeServices();
    const n = await new ChangeExecutor(m.services).executeChanges([
      { entity: new Widget(), entityClass: Widget, state: 'added' },
      { entity: new Widget(), entityClass: Widget, state: 'modified' },
      { entity: new Widget(), entityClass: Widget, state: 'deleted' }
    ]);
    expect(n).toBe(3);
  });
});

describe('ChangeExecutor.applySkipNavigationChanges', () => {
  it('dispatches inserts and deletes to the provider and counts them', async () => {
    const m = makeServices();
    const exec = new ChangeExecutor(m.services);
    const n = await exec.applySkipNavigationChanges([
      { operation: 'insert', joinRow: {}, joinEntityCtor: Widget } as never,
      { operation: 'delete', joinRow: {}, joinEntityCtor: Widget } as never
    ]);
    expect(n).toBe(2);
    expect(m.provider.insert).toHaveBeenCalledTimes(1);
    expect(m.provider.delete).toHaveBeenCalledTimes(1);
  });
});
