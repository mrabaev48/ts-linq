import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import type { QueryOptions, SqlDialect } from '@ts-linq/types';

import { QueryBuilder } from '../src/QueryBuilder';
import { QueryModel } from '../src/QueryModel';

@Entity({})
class TestEntity {
  @PrimaryKey({})
  @Column({})
  id!: number;

  @Column({})
  name!: string;

  @Column({})
  value?: number;
}

describe('QueryBuilder', () => {
  let mockDialect: jest.Mocked<SqlDialect>;
  let builder: QueryBuilder;

  beforeEach(() => {
    mockDialect = {
      buildSelect: jest.fn((ctor, opts) => ({
        query: `SELECT * FROM ${ctor.name}`,
        parameters: []
      })),
      escapeIdentifier: jest.fn((id) => `"${id}"`),
      formatValue: jest.fn((val) => '?')
    } as unknown as jest.Mocked<SqlDialect>;

    builder = new QueryBuilder(mockDialect);
  });

  afterEach(() => {
    builder.dispose();
  });

  describe('constructor', () => {
    it('should create instance with dialect', () => {
      expect(builder).toBeDefined();
      expect(builder).toBeInstanceOf(QueryBuilder);
    });

    it('should accept optional logger parameter', () => {
      const logger = {
        cache: jest.fn()
      };
      const builderWithLogger = new QueryBuilder(mockDialect, logger as any);
      expect(builderWithLogger).toBeDefined();
    });

    it('should accept optional provider name', () => {
      const builderWithProvider = new QueryBuilder(mockDialect, undefined, 'TestProvider');
      expect(builderWithProvider).toBeDefined();
    });

    it('should accept custom cache', () => {
      const customCache = {
        get: jest.fn(),
        set: jest.fn(),
        has: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        size: jest.fn(() => 0)
      };
      const builderWithCache = new QueryBuilder(mockDialect, undefined, undefined, customCache);
      expect(builderWithCache).toBeDefined();
    });

    it('should accept namespace parameter', () => {
      const builderWithNamespace = new QueryBuilder(
        mockDialect,
        undefined,
        undefined,
        undefined,
        'test-ns'
      );
      expect(builderWithNamespace).toBeDefined();
    });
  });

  describe('generateSql()', () => {
    it('should generate SQL from entity and options', () => {
      const options: QueryOptions = {};
      const result = builder.generateSql(TestEntity, options);

      expect(result).toBeDefined();
      expect(result.query).toBe('SELECT * FROM TestEntity');
      expect(result.parameters).toEqual([]);
      expect(mockDialect.buildSelect).toHaveBeenCalledWith(TestEntity, options);
    });

    it('should return cached result on second call', () => {
      const options: QueryOptions = {};

      const result1 = builder.generateSql(TestEntity, options);
      const result2 = builder.generateSql(TestEntity, options);

      expect(result1.query).toBe(result2.query);
      expect(mockDialect.buildSelect).toHaveBeenCalledTimes(1);
    });

    it('should handle select option', () => {
      const options: QueryOptions = {
        select: ['id', 'name']
      };

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT id, name FROM TestEntity',
        parameters: []
      });

      const result = builder.generateSql(TestEntity, options);

      expect(result.query).toBe('SELECT id, name FROM TestEntity');
    });

    it('should handle where conditions', () => {
      const options: QueryOptions = {
        where: [{ condition: 'id = ?', parameters: [1] }]
      };

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT * FROM TestEntity WHERE id = ?',
        parameters: [1]
      });

      const result = builder.generateSql(TestEntity, options);

      expect(result.query).toContain('WHERE');
      expect(result.parameters).toEqual([1]);
    });

    it('should handle orderBy option', () => {
      const options: QueryOptions = {
        orderBy: [{ column: 'name', direction: 'ASC' }]
      };

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT * FROM TestEntity ORDER BY name ASC',
        parameters: []
      });

      const result = builder.generateSql(TestEntity, options);

      expect(result.query).toContain('ORDER BY');
    });

    it('should handle limit and offset', () => {
      const options: QueryOptions = {
        limit: 10,
        offset: 5
      };

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT * FROM TestEntity LIMIT 10 OFFSET 5',
        parameters: []
      });

      const result = builder.generateSql(TestEntity, options);

      expect(result.query).toContain('LIMIT');
      expect(result.query).toContain('OFFSET');
    });

    it('should handle distinct option', () => {
      const options: QueryOptions = {
        distinct: true
      };

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT DISTINCT * FROM TestEntity',
        parameters: []
      });

      const result = builder.generateSql(TestEntity, options);

      expect(result.query).toContain('DISTINCT');
    });

    it('should handle groupBy option', () => {
      const options: QueryOptions = {
        groupBy: ['name']
      };

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT * FROM TestEntity GROUP BY name',
        parameters: []
      });

      const result = builder.generateSql(TestEntity, options);

      expect(result.query).toContain('GROUP BY');
    });

    it('should handle joins', () => {
      const options: QueryOptions = {
        joins: [
          {
            type: 'INNER',
            table: 'OtherEntity',
            on: 'TestEntity.id = OtherEntity.testId'
          }
        ]
      };

      mockDialect.buildSelect.mockReturnValue({
        query:
          'SELECT * FROM TestEntity INNER JOIN OtherEntity ON TestEntity.id = OtherEntity.testId',
        parameters: []
      });

      const result = builder.generateSql(TestEntity, options);

      expect(result.query).toContain('JOIN');
    });

    it('should normalize select expressions to strings', () => {
      const expr = {
        toString: () => 'UPPER(name)',
        getParameters: () => []
      };

      const options: QueryOptions = {
        select: [expr as any]
      };

      builder.generateSql(TestEntity, options);

      const normalizedOpts = mockDialect.buildSelect.mock.calls[0][1];
      expect(normalizedOpts.select).toEqual(['UPPER(name)']);
    });

    it('should extract parameters from select expressions', () => {
      const expr = {
        toString: () => 'COALESCE(value, ?)',
        getParameters: () => [0]
      };

      const options: QueryOptions = {
        select: [expr as any]
      };

      builder.generateSql(TestEntity, options);

      const normalizedOpts = mockDialect.buildSelect.mock.calls[0][1];
      expect(normalizedOpts.selectParams).toEqual([0]);
    });
  });

  describe('generateFromModel()', () => {
    it('should generate SQL from QueryModel', () => {
      const model = new QueryModel();
      model.select = ['id', 'name'];
      model.where = [];
      model.orderBy = [];
      model.groupBy = undefined;
      model.joins = [];
      model.limit = undefined;
      model.offset = undefined;
      model.distinct = false;
      model.unions = [];

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT id, name FROM TestEntity',
        parameters: []
      });

      const result = builder.generateFromModel(TestEntity, model);

      expect(result.query).toBe('SELECT id, name FROM TestEntity');
    });

    it('should handle UNION queries', () => {
      const model = new QueryModel();
      model.select = ['id'];
      model.where = [];
      model.orderBy = [];

      const otherModel = new QueryModel();
      otherModel.select = ['id'];
      otherModel.where = [];
      otherModel.orderBy = [];

      model.unions = [
        {
          entity: TestEntity,
          other: otherModel,
          all: false
        }
      ];

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT id FROM TestEntity',
        parameters: []
      });

      const result = builder.generateFromModel(TestEntity, model);

      expect(result.query).toContain('UNION');
      expect(result.query).not.toContain('UNION ALL');
    });

    it('should handle UNION ALL queries', () => {
      const model = new QueryModel();
      model.select = ['id'];
      model.where = [];
      model.orderBy = [];

      const otherModel = new QueryModel();
      otherModel.select = ['id'];
      otherModel.where = [];
      otherModel.orderBy = [];

      model.unions = [
        {
          entity: TestEntity,
          other: otherModel,
          all: true
        }
      ];

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT id FROM TestEntity',
        parameters: []
      });

      const result = builder.generateFromModel(TestEntity, model);

      expect(result.query).toContain('UNION ALL');
    });

    it('should combine parameters from UNION queries', () => {
      const model = new QueryModel();
      model.select = ['id'];
      model.where = [{ condition: 'id > ?', parameters: [1] }];
      model.orderBy = [];

      const otherModel = new QueryModel();
      otherModel.select = ['id'];
      otherModel.where = [{ condition: 'id < ?', parameters: [100] }];
      otherModel.orderBy = [];

      model.unions = [
        {
          entity: TestEntity,
          other: otherModel,
          all: false
        }
      ];

      mockDialect.buildSelect
        .mockReturnValueOnce({ query: 'SELECT id FROM TestEntity WHERE id > ?', parameters: [1] })
        .mockReturnValueOnce({
          query: 'SELECT id FROM TestEntity WHERE id < ?',
          parameters: [100]
        });

      const result = builder.generateFromModel(TestEntity, model);

      expect(result.parameters).toHaveLength(2);
      expect(result.parameters).toEqual([1, 100]);
    });

    it('should handle EXCEPT queries via setOp', () => {
      const model = new QueryModel();
      model.select = ['id'];

      const otherModel = new QueryModel();
      otherModel.select = ['id'];

      model.unions = [{ entity: TestEntity, other: otherModel, all: false, setOp: 'EXCEPT' }];

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT id FROM TestEntity',
        parameters: []
      });

      const result = builder.generateFromModel(TestEntity, model);

      expect(result.query).toBe('SELECT id FROM TestEntity EXCEPT SELECT id FROM TestEntity');
    });

    it('should handle INTERSECT queries via setOp', () => {
      const model = new QueryModel();
      model.select = ['id'];

      const otherModel = new QueryModel();
      otherModel.select = ['id'];

      model.unions = [
        {
          entity: TestEntity,
          other: otherModel,
          all: false,
          setOp: 'INTERSECT'
        }
      ];

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT id FROM TestEntity',
        parameters: []
      });

      const result = builder.generateFromModel(TestEntity, model);

      expect(result.query).toBe('SELECT id FROM TestEntity INTERSECT SELECT id FROM TestEntity');
    });

    it('should not affect UNION/UNION ALL when setOp is absent', () => {
      const model = new QueryModel();
      const otherModel = new QueryModel();

      model.unions = [{ entity: TestEntity, other: otherModel, all: true }];

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT id FROM TestEntity',
        parameters: []
      });

      const result = builder.generateFromModel(TestEntity, model);

      expect(result.query).toContain('UNION ALL');
      expect(result.query).not.toContain('EXCEPT');
      expect(result.query).not.toContain('INTERSECT');
    });
  });

  describe('caching', () => {
    it('should cache queries with same parameters', () => {
      const options: QueryOptions = { limit: 10 };

      builder.generateSql(TestEntity, options);
      builder.generateSql(TestEntity, options);

      expect(mockDialect.buildSelect).toHaveBeenCalledTimes(1);
    });

    it('should not cache queries with different parameters', () => {
      builder.generateSql(TestEntity, { limit: 10 });
      builder.generateSql(TestEntity, { limit: 20 });

      expect(mockDialect.buildSelect).toHaveBeenCalledTimes(2);
    });

    it('should differentiate cache by provider name', () => {
      const builder1 = new QueryBuilder(mockDialect, undefined, 'Provider1');
      const builder2 = new QueryBuilder(mockDialect, undefined, 'Provider2');

      const options: QueryOptions = {};

      builder1.generateSql(TestEntity, options);
      builder2.generateSql(TestEntity, options);

      expect(mockDialect.buildSelect).toHaveBeenCalledTimes(2);
    });

    it('should differentiate cache by namespace', () => {
      const builder1 = new QueryBuilder(mockDialect, undefined, undefined, undefined, 'ns1');
      const builder2 = new QueryBuilder(mockDialect, undefined, undefined, undefined, 'ns2');

      const options: QueryOptions = {};

      builder1.generateSql(TestEntity, options);
      builder2.generateSql(TestEntity, options);

      expect(mockDialect.buildSelect).toHaveBeenCalledTimes(2);
    });

    it('should log cache hits', () => {
      const logger = {
        cache: jest.fn()
      };

      const builderWithLogger = new QueryBuilder(mockDialect, logger as any);
      const options: QueryOptions = {};

      builderWithLogger.generateSql(TestEntity, options);
      builderWithLogger.generateSql(TestEntity, options);

      expect(logger.cache).toHaveBeenCalledWith(
        expect.objectContaining({ cache: 'sqlGen', hit: true })
      );
    });

    it('should log cache misses', () => {
      const logger = {
        cache: jest.fn()
      };

      const builderWithLogger = new QueryBuilder(mockDialect, logger as any);
      const options: QueryOptions = {};

      builderWithLogger.generateSql(TestEntity, options);

      expect(logger.cache).toHaveBeenCalledWith(
        expect.objectContaining({ cache: 'sqlGen', hit: false })
      );
    });
  });

  describe('cache management', () => {
    it('clearCache() should reset instance cache', () => {
      const options: QueryOptions = {};

      builder.generateSql(TestEntity, options);
      builder.clearCache();
      builder.generateSql(TestEntity, options);

      expect(mockDialect.buildSelect).toHaveBeenCalledTimes(2);
    });

    it('dispose() should clear instance cache', () => {
      const options: QueryOptions = {};

      builder.generateSql(TestEntity, options);
      builder.dispose();
      // Re-create after dispose since cache is cleared
      builder = new QueryBuilder(mockDialect);
      builder.generateSql(TestEntity, options);

      expect(mockDialect.buildSelect).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCacheMetrics()', () => {
    it('should return cache metrics from EnhancedSqlCache', () => {
      const metrics = builder.getCacheMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('currentSize');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('hits');
      expect(metrics).toHaveProperty('misses');
      expect(metrics).toHaveProperty('hitRatio');
    });

    it('should return fallback metrics for basic cache', () => {
      const basicCache = {
        get: jest.fn(),
        set: jest.fn(),
        has: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        size: jest.fn(() => 5)
      };

      const builderWithBasicCache = new QueryBuilder(mockDialect, undefined, undefined, basicCache);
      const metrics = builderWithBasicCache.getCacheMetrics();

      expect(metrics.currentSize).toBe(5);
      expect(metrics.totalRequests).toBe(0);
    });
  });

  describe('getOptimizationInsights()', () => {
    it('should return optimization insights from EnhancedSqlCache', () => {
      const insights = builder.getOptimizationInsights();

      expect(insights).toBeDefined();
      expect(insights).toHaveProperty('shouldIncreaseSize');
      expect(insights).toHaveProperty('shouldDecreaseTtl');
      expect(insights).toHaveProperty('shouldIncreaseTtl');
      expect(insights).toHaveProperty('topAccessedEntries');
    });

    it('should return fallback insights for basic cache', () => {
      const basicCache = {
        get: jest.fn(),
        set: jest.fn(),
        has: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        size: jest.fn(() => 0)
      };

      const builderWithBasicCache = new QueryBuilder(mockDialect, undefined, undefined, basicCache);
      const insights = builderWithBasicCache.getOptimizationInsights();

      expect(insights.shouldIncreaseSize).toBe(false);
      expect(insights.topAccessedEntries).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty QueryOptions', () => {
      const result = builder.generateSql(TestEntity, {});

      expect(result).toBeDefined();
      expect(result.query).toBeTruthy();
    });

    it('should handle null/undefined in where conditions', () => {
      const options: QueryOptions = {
        where: undefined
      };

      const result = builder.generateSql(TestEntity, options);

      expect(result).toBeDefined();
    });

    it('should return immutable parameters array', () => {
      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT * FROM TestEntity',
        parameters: [1, 2, 3]
      });

      const result = builder.generateSql(TestEntity, {});
      const params1 = result.parameters;

      const result2 = builder.generateSql(TestEntity, {});
      const params2 = result2.parameters;

      expect(params1).not.toBe(params2);
      expect(params1).toEqual(params2);
    });
  });
});
