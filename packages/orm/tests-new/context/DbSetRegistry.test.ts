/**
 * Isolated unit tests for DbSetRegistry (refactor orm/task-1).
 * DbSet factory guards + DbSetContext assembly with mocked services.
 */
import 'reflect-metadata';

import { describe, expect, it, jest } from '@jest/globals';

import type { DbContextServices } from '../../src/context/DbContextServices';
import { DbSetRegistry } from '../../src/context/DbSetRegistry';

class Widget {}

function makeRegistry(opts: { entities?: unknown[] } = {}) {
  const tx = {
    beginTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined)
  };
  const services = {
    provider: { id: 'provider' },
    changeTracker: { id: 'ct' },
    entityLoader: { id: 'loader' },
    entityCache: undefined,
    performanceOptions: { id: 'perf' },
    globalFilters: undefined,
    softDelete: undefined,
    querySplittingBehavior: undefined,
    executionStrategyOptions: undefined,
    entityQueryFilterMap: new Map(),
    registry: { getEntities: jest.fn(() => opts.entities ?? []) }
  } as unknown as DbContextServices;
  return { registry: new DbSetRegistry(services, tx), services, tx };
}

describe('DbSetRegistry', () => {
  it('set() throws for an unconfigured entity', () => {
    const { registry } = makeRegistry();
    expect(() => registry.set(Widget)).toThrow(/DbSet for Widget is not configured/);
  });

  it('buildDbSetContext wires provider/registry from services and the tx delegators', async () => {
    const { registry, services, tx } = makeRegistry();
    const ctx = registry.buildDbSetContext();

    expect(ctx.provider).toBe(services.provider);
    expect(ctx.registry).toBe(services.registry);

    await ctx.beginTransaction!();
    await ctx.commitTransaction!();
    await ctx.rollbackTransaction!();
    expect(tx.beginTransaction).toHaveBeenCalledTimes(1);
    expect(tx.commitTransaction).toHaveBeenCalledTimes(1);
    expect(tx.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('initialize() with an empty registry defines no properties and does not throw', () => {
    const { registry } = makeRegistry({ entities: [] });
    const target: Record<string, unknown> = {};
    expect(() => registry.initialize(target)).not.toThrow();
    expect(Object.keys(target)).toHaveLength(0);
  });
});
