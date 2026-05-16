import type { QueryFallback } from '@ts-linq/types';
import { FallbackManager } from '../src/FallbackManager';

interface TestEntity {
  id: number;
  name: string;
}

function makeFallback(label: string): QueryFallback<TestEntity> {
  return {
    label,
    canHandle: () => true,
    execute: async () => [],
    fetch: async () => []
  };
}

describe('FallbackManager', () => {
  it('create() produces an empty manager', () => {
    const mgr = FallbackManager.create<TestEntity>();
    expect(mgr.fallbacks).toHaveLength(0);
    expect(mgr.throttle.windowStart).toBe(0);
    expect(mgr.throttle.usedInWindow).toBe(0);
    expect(mgr.throttle.lastAttemptAt).toBe(0);
  });

  it('add() appends fallback sources', () => {
    const mgr = FallbackManager.create<TestEntity>();
    mgr.add(makeFallback('cache'));
    mgr.add(makeFallback('replica'));
    expect(mgr.fallbacks).toHaveLength(2);
    expect(mgr.fallbacks[0]!.label).toBe('cache');
    expect(mgr.fallbacks[1]!.label).toBe('replica');
  });

  it('clone() copies fallbacks and deep-copies throttle state', () => {
    const mgr = FallbackManager.create<TestEntity>();
    mgr.add(makeFallback('cache'));
    mgr.throttle.lastAttemptAt = 42;

    const copy = mgr.clone();

    // Fallbacks are copied (same entries, different array)
    expect(copy.fallbacks).toHaveLength(1);
    expect(copy.fallbacks).not.toBe(mgr.fallbacks);
    expect(copy.fallbacks[0]!.label).toBe('cache');

    // Throttle is a different object but carries the same snapshot values
    expect(copy.throttle).not.toBe(mgr.throttle);
    expect(copy.throttle.lastAttemptAt).toBe(42);
  });

  it('mutations to throttle in the clone do not affect the original', () => {
    const mgr = FallbackManager.create<TestEntity>();
    const copy = mgr.clone();

    copy.throttle.usedInWindow = 5;

    expect(mgr.throttle.usedInWindow).toBe(0);
  });

  it('throttle state is independent between siblings cloned from the same parent', () => {
    const parent = FallbackManager.create<TestEntity>();
    const cloneA = parent.clone();
    const cloneB = parent.clone();

    cloneA.throttle.usedInWindow = 3;
    cloneB.throttle.lastAttemptAt = 999;

    expect(parent.throttle.usedInWindow).toBe(0);
    expect(parent.throttle.lastAttemptAt).toBe(0);
    expect(cloneB.throttle.usedInWindow).toBe(0);
    expect(cloneA.throttle.lastAttemptAt).toBe(0);
  });

  it('adding to copy does not affect original', () => {
    const mgr = FallbackManager.create<TestEntity>();
    mgr.add(makeFallback('primary-fallback'));

    const copy = mgr.clone();
    copy.add(makeFallback('secondary-fallback'));

    expect(mgr.fallbacks).toHaveLength(1);
    expect(copy.fallbacks).toHaveLength(2);
  });

  // Criterion 4: FallbackManager is testable with zero provider dependencies.
  it('requires no DatabaseProvider to construct and operate', () => {
    // This test documents that query-building concerns (fallback state)
    // are independently testable without wiring up a provider.
    const mgr = FallbackManager.create<TestEntity>();
    const fb = makeFallback('local-cache');
    mgr.add(fb);
    expect(mgr.fallbacks[0]).toBe(fb);
  });
});
