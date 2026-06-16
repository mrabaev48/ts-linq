/**
 * Isolated unit tests for DbContextBootstrapper (refactor orm/task-1).
 * Verifies the services value object is wired and defaulting applied, and that
 * the onModelCreating hook runs during construction.
 */
import 'reflect-metadata';

import { describe, expect, it, jest } from '@jest/globals';
import { LoadingStrategy } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';

import { DbContextBootstrapper } from '../../src/context/DbContextBootstrapper';
import { TestProvider } from '../../tests/stubs/TestProvider';

function bootstrap(extra: Record<string, unknown> = {}, hook = jest.fn()) {
  const provider = new TestProvider(':memory:');
  const configureSoftDelete = jest.spyOn(provider, 'configureSoftDelete');
  const services = DbContextBootstrapper.bootstrap(
    { provider, registry: MetadataStorage.getInstance(), ...extra } as never,
    hook
  );
  return { services, provider, configureSoftDelete, hook };
}

describe('DbContextBootstrapper.bootstrap', () => {
  it('returns the provider and runs provider side effects', () => {
    const b = bootstrap();
    expect(b.services.provider).toBe(b.provider);
    expect(b.configureSoftDelete).toHaveBeenCalledTimes(1);
  });

  it('invokes the onModelCreating hook exactly once with a model builder', () => {
    const b = bootstrap();
    expect(b.hook).toHaveBeenCalledTimes(1);
    expect(b.hook.mock.calls[0][0]).toBeDefined();
  });

  it('defaults maxBatchSize to 0 and loading strategy to Eager', () => {
    const b = bootstrap();
    expect(b.services.maxBatchSize).toBe(0);
    expect(b.services.defaultLoadingStrategy).toBe(LoadingStrategy.Eager);
  });

  it('auto-injects a count cache and an owned SQL cache when none supplied', () => {
    const b = bootstrap();
    expect(b.services.performanceOptions?.countCache).toBeDefined();
    expect(b.services.ownedSqlCache).toBeDefined();
  });

  it('honours an explicit maxBatchSize', () => {
    const b = bootstrap({ maxBatchSize: 50 });
    expect(b.services.maxBatchSize).toBe(50);
  });
});
