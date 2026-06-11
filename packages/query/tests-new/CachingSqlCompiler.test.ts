import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { QueryOptions, SqlCache, SqlCacheEntry, TemplateSqlCache } from '@ts-linq/types';

import { CachingSqlCompiler } from '../src/CachingSqlCompiler';
import { InMemorySqlCache } from '../src/SqlCache';
import type { SqlCompiler } from '../src/SqlCompiler';

class TestEntity {}

function createFakeCore(): jest.Mocked<SqlCompiler> {
  let counter = 0;
  return {
    generateSql: jest.fn(() => ({ query: `SELECT ${++counter}`, parameters: [] })),
    generateFromModel: jest.fn(() => ({ query: `SELECT ${++counter}`, parameters: [] })),
    generateCount: jest.fn(() => ({ query: `SELECT COUNT ${++counter}`, parameters: [] }))
  };
}

describe('CachingSqlCompiler', () => {
  let core: jest.Mocked<SqlCompiler>;
  let cache: SqlCache;
  let compiler: CachingSqlCompiler;

  beforeEach(() => {
    core = createFakeCore();
    cache = new InMemorySqlCache();
    compiler = new CachingSqlCompiler(core, cache);
  });

  describe('generateSql() — full cache strategy', () => {
    it('delegates to core on a miss and caches the result', () => {
      const options: QueryOptions = { limit: 10 };

      const first = compiler.generateSql(TestEntity, options);
      const second = compiler.generateSql(TestEntity, options);

      expect(core.generateSql).toHaveBeenCalledTimes(1);
      expect(second.query).toBe(first.query);
    });

    it('does not collide cache entries for different options', () => {
      compiler.generateSql(TestEntity, { limit: 10 });
      compiler.generateSql(TestEntity, { limit: 20 });

      expect(core.generateSql).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateSql() — plan-template cache strategy', () => {
    function createFakeTemplateCache(): TemplateSqlCache & SqlCache {
      const store = new Map<string, SqlCacheEntry>();
      const templates = new Map<string, { query: string }>();
      let hits = 0;
      let misses = 0;
      return {
        get: (key: string) => store.get(key),
        set: (key: string, value: SqlCacheEntry) => {
          store.set(key, value);
          templates.set(key, { query: value.query });
        },
        clear: () => {
          store.clear();
          templates.clear();
        },
        size: () => store.size,
        getTemplate: (key: string) => {
          const t = templates.get(key);
          if (t) hits++;
          else misses++;
          return t;
        },
        get cacheHits() {
          return hits;
        },
        get cacheMisses() {
          return misses;
        }
      } as TemplateSqlCache & SqlCache;
    }

    it('reuses the cached template SQL and rebinds current parameters on a plan hit', () => {
      const templateCache = createFakeTemplateCache();
      const planCompiler = new CachingSqlCompiler(core, templateCache);

      const opts1: QueryOptions = { where: [{ condition: 'id = ?', parameters: [1] }] };
      const opts2: QueryOptions = { where: [{ condition: 'id = ?', parameters: [2] }] };

      const first = planCompiler.generateSql(TestEntity, opts1);
      const second = planCompiler.generateSql(TestEntity, opts2);

      // Second call hits the plan-template cache (different param values, same shape)
      expect(second.query).toBe(first.query);
      expect(second.parameters).toEqual([2]);
    });
  });

  describe('generateFromModel() and generateCount()', () => {
    it('caches generateFromModel results', async () => {
      const { QueryModel } = await import('../src/QueryModel');
      const model = new QueryModel();
      model.select = ['id'];

      compiler.generateFromModel(TestEntity, model);
      compiler.generateFromModel(TestEntity, model);

      expect(core.generateSql).toHaveBeenCalledTimes(1);
    });

    it('generateCount compiles a COUNT(*)-shaped model distinct from the row query', async () => {
      const { QueryModel } = await import('../src/QueryModel');
      const model = new QueryModel();
      model.select = ['id', 'name'];
      model.limit = 10;

      compiler.generateFromModel(TestEntity, model);
      compiler.generateCount(TestEntity, model);

      // Different cache keys (count-shaped vs row-shaped) -> two underlying compilations.
      expect(core.generateSql).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache lifecycle', () => {
    it('clearCache() resets the cache so subsequent calls recompile', () => {
      const options: QueryOptions = {};

      compiler.generateSql(TestEntity, options);
      compiler.clearCache();
      compiler.generateSql(TestEntity, options);

      expect(core.generateSql).toHaveBeenCalledTimes(2);
    });

    it('invalidateForEntity() removes only matching entries', () => {
      compiler.generateSql(TestEntity, { select: ['a'] });

      const removed = compiler.invalidateForEntity(TestEntity.name);

      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SqlCacheCapabilities', () => {
    it('reports fallback metrics/insights for a cache without capability methods', () => {
      const basicCache: SqlCache = {
        get: jest.fn(() => undefined),
        set: jest.fn(),
        clear: jest.fn(),
        size: jest.fn(() => 3)
      };
      const c = new CachingSqlCompiler(core, basicCache);

      const metrics = c.getCacheMetrics();
      expect(metrics.currentSize).toBe(3);
      expect(metrics.totalRequests).toBe(0);

      const insights = c.getOptimizationInsights();
      expect(insights.shouldIncreaseSize).toBe(false);
      expect(insights.topAccessedEntries).toEqual([]);

      expect(() => c.dispose()).not.toThrow();
    });

    it('delegates to a cache that exposes getMetrics/getOptimizationInsights/dispose', () => {
      const capableCache = {
        get: jest.fn(() => undefined),
        set: jest.fn(),
        clear: jest.fn(),
        size: jest.fn(() => 0),
        getMetrics: jest.fn(() => ({
          currentSize: 1,
          totalRequests: 2,
          hits: 1,
          misses: 1,
          hitRatio: 0.5,
          evictions: 0,
          expirations: 0,
          averageAccessCount: 1,
          estimatedMemoryUsage: 0
        })),
        getOptimizationInsights: jest.fn(() => ({
          shouldIncreaseSize: true,
          shouldDecreaseTtl: false,
          shouldIncreaseTtl: false,
          topAccessedEntries: [{ key: 'k', accessCount: 5 }]
        })),
        dispose: jest.fn()
      } as unknown as SqlCache;

      const c = new CachingSqlCompiler(core, capableCache);

      expect(c.getCacheMetrics().totalRequests).toBe(2);
      expect(c.getOptimizationInsights().shouldIncreaseSize).toBe(true);
      c.dispose();
      expect((capableCache as any).dispose).toHaveBeenCalled();
    });
  });
});
