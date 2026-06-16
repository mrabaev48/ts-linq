/**
 * Isolated unit tests for TransactionScope (refactor orm/task-1).
 * Depth bookkeeping + begin/commit/rollback with mocked provider/cache.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { DbContextServices } from '../../src/context/DbContextServices';
import { TransactionScope } from '../../src/context/TransactionScope';

function makeServices() {
  const provider = {
    beginTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    loggerRef: undefined,
    providerLabel: 'test'
  };
  const cacheCoordinator = {
    invalidateOnCommit: jest.fn(),
    clearAll: jest.fn()
  };
  const services = {
    provider,
    cacheCoordinator,
    entityCache: undefined
  } as unknown as DbContextServices;
  return { services, provider, cacheCoordinator };
}

describe('TransactionScope', () => {
  let ctx: ReturnType<typeof makeServices>;
  let scope: TransactionScope;

  beforeEach(() => {
    ctx = makeServices();
    scope = new TransactionScope(ctx.services);
  });

  it('starts inactive', () => {
    expect(scope.isActive).toBe(false);
  });

  it('begin opens a real provider transaction only at depth 0', async () => {
    await scope.begin();
    expect(scope.isActive).toBe(true);
    expect(ctx.provider.beginTransaction).toHaveBeenCalledTimes(1);

    await scope.begin(); // nested — absorbed
    expect(ctx.provider.beginTransaction).toHaveBeenCalledTimes(1);
    expect(scope.isActive).toBe(true);
  });

  it('nested commit only decrements; outermost commit commits + invalidates', async () => {
    await scope.begin();
    await scope.begin();

    await scope.commit(); // depth 2 -> 1: no real commit
    expect(ctx.provider.commitTransaction).not.toHaveBeenCalled();
    expect(ctx.cacheCoordinator.invalidateOnCommit).not.toHaveBeenCalled();
    expect(scope.isActive).toBe(true);

    await scope.commit(); // depth 1 -> 0: real commit
    expect(ctx.provider.commitTransaction).toHaveBeenCalledTimes(1);
    expect(ctx.cacheCoordinator.invalidateOnCommit).toHaveBeenCalledTimes(1);
    expect(scope.isActive).toBe(false);
  });

  it('rollback resets depth unconditionally and clears caches', async () => {
    await scope.begin();
    await scope.begin();

    await scope.rollback();
    expect(ctx.provider.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(ctx.cacheCoordinator.clearAll).toHaveBeenCalledTimes(1);
    expect(scope.isActive).toBe(false);
  });

  it('reset clears the depth counter', async () => {
    await scope.begin();
    expect(scope.isActive).toBe(true);
    scope.reset();
    expect(scope.isActive).toBe(false);
  });
});
