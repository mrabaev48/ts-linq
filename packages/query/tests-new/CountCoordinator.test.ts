/**
 * Unit tests for {@link CountCoordinator} — the stateless count-cache / single-flight collaborator
 * extracted from `Queryable` (refactor query/task-1).
 */
import type { DatabaseProvider } from '@ts-linq/core';
import type { CountCache, PerformanceOptions } from '@ts-linq/types';

import { CountCoordinator, type CountRequest } from '../src/CountCoordinator';
import { QueryModel } from '../src/QueryModel';

function makeProvider(): DatabaseProvider {
  return {
    providerLabel: 'test',
    loggerRef: undefined
  } as unknown as DatabaseProvider;
}

/** Map-backed external count cache. */
function makeCountCache(): CountCache & { store: Map<string, number> } {
  const store = new Map<string, number>();
  return {
    store,
    get: (key: string) => store.get(key),
    set: (key: string, value: number) => {
      store.set(key, value);
    }
  } as unknown as CountCache & { store: Map<string, number> };
}

interface CountingExecutor {
  executeCount: jest.Mock;
}

function makeExecutor(impl: () => Promise<number>): CountingExecutor {
  return { executeCount: jest.fn(impl) };
}

function baseRequest(overrides: Partial<CountRequest>): CountRequest {
  return {
    entityName: 'Widget',
    tableName: 'widgets',
    whereSignature: '[]',
    performance: undefined,
    provider: makeProvider(),
    executor: makeExecutor(async () => 7),
    inflightCounts: new Map(),
    externalCountCache: undefined,
    prepareModel: () => new QueryModel(),
    ...overrides
  };
}

describe('CountCoordinator', () => {
  const coordinator = new CountCoordinator();

  it('without count cache, runs the count once and returns the value', async () => {
    let prepared = 0;
    const executor = makeExecutor(async () => 42);
    const req = baseRequest({
      executor,
      prepareModel: () => {
        prepared++;
        return new QueryModel();
      }
    });

    const result = await coordinator.count(req);

    expect(result).toBe(42);
    expect(executor.executeCount).toHaveBeenCalledTimes(1);
    expect(prepared).toBe(1);
  });

  it('returns the cached value without preparing a model or hitting the executor', async () => {
    const cache = makeCountCache();
    const executor = makeExecutor(async () => 99);
    let prepared = 0;
    const performance: PerformanceOptions = { enableCountCache: true };
    // Seed the cache under the key the coordinator will compute.
    cache.store.set('test|Widget|count|widgets|[]', 5);

    const result = await coordinator.count(
      baseRequest({
        performance,
        externalCountCache: cache,
        executor,
        prepareModel: () => {
          prepared++;
          return new QueryModel();
        }
      })
    );

    expect(result).toBe(5);
    expect(executor.executeCount).not.toHaveBeenCalled();
    expect(prepared).toBe(0);
  });

  it('on a cache miss, runs the count, stores it and cleans up the in-flight entry', async () => {
    const cache = makeCountCache();
    const inflight = new Map<string, Promise<number>>();
    const executor = makeExecutor(async () => 13);
    const performance: PerformanceOptions = { enableCountCache: true };

    const result = await coordinator.count(
      baseRequest({ performance, externalCountCache: cache, executor, inflightCounts: inflight })
    );

    expect(result).toBe(13);
    expect(executor.executeCount).toHaveBeenCalledTimes(1);
    expect(cache.store.get('test|Widget|count|widgets|[]')).toBe(13);
    expect(inflight.size).toBe(0);
  });

  it('single-flights concurrent counts sharing a key (executor invoked once)', async () => {
    const inflight = new Map<string, Promise<number>>();
    let resolveCount: (n: number) => void = () => {};
    const executor = makeExecutor(
      () =>
        new Promise<number>((resolve) => {
          resolveCount = resolve;
        })
    );
    const performance: PerformanceOptions = { enableCountCache: true };
    const req = (): CountRequest =>
      baseRequest({ performance, executor, inflightCounts: inflight });

    const p1 = coordinator.count(req());
    const p2 = coordinator.count(req());
    // Both calls observe the same in-flight promise before it settles.
    expect(executor.executeCount).toHaveBeenCalledTimes(1);

    resolveCount(21);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe(21);
    expect(r2).toBe(21);
    expect(executor.executeCount).toHaveBeenCalledTimes(1);
    expect(inflight.size).toBe(0);
  });

  it('honors cacheNamespace in the cache key', async () => {
    const cache = makeCountCache();
    const performance: PerformanceOptions = { enableCountCache: true, cacheNamespace: 'tenantA' };

    await coordinator.count(
      baseRequest({ performance, externalCountCache: cache, executor: makeExecutor(async () => 3) })
    );

    expect(cache.store.has('tenantA|test|Widget|count|widgets|[]')).toBe(true);
  });
});
