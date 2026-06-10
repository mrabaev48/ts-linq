import 'reflect-metadata';

import type { DatabaseProvider } from '@ts-linq/core';
import { Column, Entity, MetadataStorage, PrimaryKey } from '@ts-linq/metadata';
import type { EntityCacheLike, PerformanceOptions } from '@ts-linq/types';

import { RowMaterializer } from '../src/RowMaterializer';

@Entity({ name: 'rm_telemetry' })
class RmTelemetry {
  @PrimaryKey()
  id!: number;
  @Column({ name: 'name' })
  name!: string;
}

/**
 * Telemetry-with-ignore coverage (query/task-8): a failing metric callback must NOT break
 * materialization, but the failure must be routed through logInternalError (→ console.error)
 * rather than silently swallowed.
 */
describe('RowMaterializer — telemetry failures never break materialization', () => {
  let errSpy: jest.SpyInstance;

  beforeAll(() => {
    MetadataStorage.getEntity(RmTelemetry);
  });

  beforeEach(() => {
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
  });

  it('survives a throwing notifyEntityMaterialized telemetry hook', () => {
    const provider = {
      providerLabel: 'test',
      loggerRef: undefined,
      notifyEntityMaterialized: () => {
        throw new Error('notify telemetry boom');
      }
    } as unknown as DatabaseProvider;

    const materializer = new RowMaterializer<RmTelemetry>(RmTelemetry, provider);

    const entity = materializer.mapRowToEntity({ id: 1, name: 'a' });

    expect(entity).toBeInstanceOf(RmTelemetry);
    expect(entity.id).toBe(1);
    expect(errSpy).toHaveBeenCalled();
    expect(String(errSpy.mock.calls[0][0])).toContain('materializer.notifyMaterialized');
  });

  it('survives a throwing cacheSize telemetry hook on the L2-cache path', () => {
    const cache: EntityCacheLike = {
      get: () => undefined,
      set: () => {},
      size: () => 1
    } as unknown as EntityCacheLike;

    const provider = {
      providerLabel: 'test',
      loggerRef: {
        cache: () => {},
        cacheSize: () => {
          throw new Error('cacheSize telemetry boom');
        }
      }
    } as unknown as DatabaseProvider;

    const performance = { enableEntityCache: true } as PerformanceOptions;
    const materializer = new RowMaterializer<RmTelemetry>(
      RmTelemetry,
      provider,
      cache,
      performance
    );

    const entity = materializer.mapRowToEntity({ id: 2, name: 'b' });

    expect(entity).toBeInstanceOf(RmTelemetry);
    expect(entity.id).toBe(2);
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes('materializer.cacheSize'))).toBe(
      true
    );
  });
});
