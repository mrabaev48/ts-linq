import { beforeEach, describe, expect, it } from '@jest/globals';
import type { QueryOptions, SqlDialect } from '@ts-linq/types';

import { QueryModel } from '../src/QueryModel';
import { buildCountModel, SqlCompilerImpl } from '../src/SqlCompiler';

class TestEntity {}

describe('SqlCompilerImpl', () => {
  let mockDialect: jest.Mocked<SqlDialect>;
  let compiler: SqlCompilerImpl;

  beforeEach(() => {
    mockDialect = {
      buildSelect: jest.fn((ctor, opts) => ({
        query: `SELECT * FROM ${ctor.name}`,
        parameters: []
      })),
      escapeIdentifier: jest.fn((id) => `"${id}"`),
      formatValue: jest.fn((val) => '?')
    } as unknown as jest.Mocked<SqlDialect>;

    compiler = new SqlCompilerImpl(mockDialect);
  });

  describe('generateSql()', () => {
    it('delegates to the dialect with no caching (always invokes buildSelect)', () => {
      const options: QueryOptions = {};

      compiler.generateSql(TestEntity, options);
      compiler.generateSql(TestEntity, options);

      expect(mockDialect.buildSelect).toHaveBeenCalledTimes(2);
    });

    it('normalizes select expressions to strings and extracts their parameters', () => {
      const expr = {
        toString: () => 'COALESCE(value, ?)',
        getParameters: () => [0]
      };

      compiler.generateSql(TestEntity, { select: [expr as any] });

      const normalizedOpts = mockDialect.buildSelect.mock.calls[0][1];
      expect(normalizedOpts.select).toEqual(['COALESCE(value, ?)']);
      expect(normalizedOpts.selectParams).toEqual([0]);
    });

    it('passes through where/orderBy/groupBy/joins/limit/offset/distinct', () => {
      const options: QueryOptions = {
        where: [{ condition: 'id = ?', parameters: [1] }],
        orderBy: [{ column: 'name', direction: 'ASC' }],
        groupBy: ['name'],
        joins: [{ type: 'INNER', table: 'Other', on: 'a.id = b.id' }],
        limit: 10,
        offset: 5,
        distinct: true
      };

      compiler.generateSql(TestEntity, options);

      const normalizedOpts = mockDialect.buildSelect.mock.calls[0][1];
      expect(normalizedOpts).toMatchObject(options as unknown as Record<string, unknown>);
    });
  });

  describe('generateFromModel()', () => {
    it('maps QueryModel fields to QueryOptions and compiles', () => {
      const model = new QueryModel();
      model.select = ['id', 'name'];

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT id, name FROM TestEntity',
        parameters: []
      });

      const result = compiler.generateFromModel(TestEntity, model);

      expect(result.query).toBe('SELECT id, name FROM TestEntity');
    });

    it('handles UNION/UNION ALL/EXCEPT/INTERSECT chains', () => {
      const model = new QueryModel();
      model.select = ['id'];
      const otherModel = new QueryModel();
      otherModel.select = ['id'];

      model.unions = [{ entity: TestEntity, other: otherModel, all: false, setOp: 'EXCEPT' }];

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT id FROM TestEntity',
        parameters: []
      });

      const result = compiler.generateFromModel(TestEntity, model);

      expect(result.query).toBe('SELECT id FROM TestEntity EXCEPT SELECT id FROM TestEntity');
    });

    it('combines parameters across union branches', () => {
      const model = new QueryModel();
      model.select = ['id'];
      model.where = [{ condition: 'id > ?', parameters: [1] }];

      const otherModel = new QueryModel();
      otherModel.select = ['id'];
      otherModel.where = [{ condition: 'id < ?', parameters: [100] }];

      model.unions = [{ entity: TestEntity, other: otherModel, all: false }];

      mockDialect.buildSelect
        .mockReturnValueOnce({ query: 'SELECT id FROM TestEntity WHERE id > ?', parameters: [1] })
        .mockReturnValueOnce({
          query: 'SELECT id FROM TestEntity WHERE id < ?',
          parameters: [100]
        });

      const result = compiler.generateFromModel(TestEntity, model);

      expect(result.parameters).toEqual([1, 100]);
    });

    it('prepends tag comments outside of the compiled SQL', () => {
      const model = new QueryModel();
      model.select = ['id'];
      model.tags = ['my-tag'];

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT id FROM TestEntity',
        parameters: []
      });

      const result = compiler.generateFromModel(TestEntity, model);

      expect(result.query).toContain('my-tag');
      expect(result.query.endsWith('SELECT id FROM TestEntity')).toBe(true);
    });
  });

  describe('generateCount()', () => {
    it('produces a COUNT(*) query with ordering/paging/distinct stripped', () => {
      const model = new QueryModel();
      model.select = ['id', 'name'];
      model.orderBy = [{ column: 'name', direction: 'ASC' }];
      model.limit = 10;
      model.offset = 5;
      model.distinct = true;

      mockDialect.buildSelect.mockReturnValue({
        query: 'SELECT COUNT(*) as count FROM TestEntity',
        parameters: []
      });

      compiler.generateCount(TestEntity, model);

      const normalizedOpts = mockDialect.buildSelect.mock.calls[0][1];
      expect(normalizedOpts.select).toEqual(['COUNT(*) as count']);
      expect(normalizedOpts.orderBy).toBeUndefined();
      expect(normalizedOpts.limit).toBeUndefined();
      expect(normalizedOpts.offset).toBeUndefined();
      expect(normalizedOpts.distinct).toBe(false);
    });

    it('does not mutate the original model', () => {
      const model = new QueryModel();
      model.select = ['id', 'name'];
      model.orderBy = [{ column: 'name', direction: 'ASC' }];
      model.limit = 10;
      model.distinct = true;

      compiler.generateCount(TestEntity, model);

      expect(model.select).toEqual(['id', 'name']);
      expect(model.orderBy).toEqual([{ column: 'name', direction: 'ASC' }]);
      expect(model.limit).toBe(10);
      expect(model.distinct).toBe(true);
    });
  });
});

describe('buildCountModel()', () => {
  it('returns a clone shaped for COUNT(*) without mutating the input', () => {
    const model = new QueryModel();
    model.select = ['id', 'name'];
    model.where = [{ condition: 'id > ?', parameters: [1] }];
    model.orderBy = [{ column: 'name', direction: 'ASC' }];
    model.limit = 10;
    model.offset = 5;
    model.distinct = true;

    const countModel = buildCountModel(model);

    expect(countModel).not.toBe(model);
    expect(countModel.select).toEqual(['COUNT(*) as count']);
    expect(countModel.orderBy).toBeUndefined();
    expect(countModel.limit).toBeUndefined();
    expect(countModel.offset).toBeUndefined();
    expect(countModel.distinct).toBe(false);
    // where/filtering must be preserved
    expect(countModel.where).toEqual(model.where);

    expect(model.select).toEqual(['id', 'name']);
    expect(model.distinct).toBe(true);
  });
});
