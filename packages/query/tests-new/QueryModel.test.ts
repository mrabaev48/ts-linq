import { describe, it, expect } from '@jest/globals';
import { QueryModel } from '../src/QueryModel';

describe('QueryModel', () => {
  describe('constructor', () => {
    it('should create empty instance', () => {
      const model = new QueryModel();

      expect(model).toBeDefined();
      expect(model.select).toBeUndefined();
      expect(model.where).toBeUndefined();
      expect(model.orderBy).toBeUndefined();
      expect(model.groupBy).toBeUndefined();
      expect(model.joins).toBeUndefined();
      expect(model.limit).toBeUndefined();
      expect(model.offset).toBeUndefined();
      expect(model.distinct).toBeUndefined();
      expect(model.unions).toBeUndefined();
      expect(model.from).toBeUndefined();
    });

    it('should allow setting properties', () => {
      const model = new QueryModel();
      model.select = ['id', 'name'];
      model.limit = 10;
      model.offset = 5;
      model.distinct = true;

      expect(model.select).toEqual(['id', 'name']);
      expect(model.limit).toBe(10);
      expect(model.offset).toBe(5);
      expect(model.distinct).toBe(true);
    });
  });

  describe('clone()', () => {
    it('should create deep copy of model', () => {
      const original = new QueryModel();
      original.select = ['id', 'name'];
      original.where = [{ condition: 'id = ?', parameters: [1] }];
      original.limit = 10;

      const cloned = original.clone();

      expect(cloned).not.toBe(original);
      expect(cloned.select).toEqual(original.select);
      expect(cloned.select).not.toBe(original.select);
      expect(cloned.where).toEqual(original.where);
      expect(cloned.where).not.toBe(original.where);
      expect(cloned.limit).toBe(original.limit);
    });

    it('should handle undefined properties', () => {
      const original = new QueryModel();
      const cloned = original.clone();

      expect(cloned.select).toBeUndefined();
      expect(cloned.where).toBeUndefined();
      expect(cloned.orderBy).toBeUndefined();
    });

    it('should clone select array', () => {
      const original = new QueryModel();
      original.select = ['id', 'name'];

      const cloned = original.clone();
      cloned.select!.push('value');

      expect(original.select).toEqual(['id', 'name']);
      expect(cloned.select).toEqual(['id', 'name', 'value']);
    });

    it('should clone where clauses', () => {
      const original = new QueryModel();
      original.where = [
        { condition: 'id = ?', parameters: [1] },
        { condition: 'name = ?', parameters: ['test'] }
      ];

      const cloned = original.clone();
      cloned.where![0].condition = 'id != ?';
      cloned.where![0].parameters = [2];

      expect(original.where![0].condition).toBe('id = ?');
      expect(original.where![0].parameters).toEqual([1]);
      expect(cloned.where![0].condition).toBe('id != ?');
      expect(cloned.where![0].parameters).toEqual([2]);
    });

    it('should clone orderBy clauses', () => {
      const original = new QueryModel();
      original.orderBy = [
        { column: 'id', direction: 'ASC' },
        { column: 'name', direction: 'DESC' }
      ];

      const cloned = original.clone();
      cloned.orderBy![0].direction = 'DESC';

      expect(original.orderBy![0].direction).toBe('ASC');
      expect(cloned.orderBy![0].direction).toBe('DESC');
    });

    it('should clone groupBy with columns only', () => {
      const original = new QueryModel();
      original.groupBy = {
        columns: ['category', 'status'],
        having: undefined
      };

      const cloned = original.clone();
      cloned.groupBy!.columns.push('type');

      expect(original.groupBy!.columns).toEqual(['category', 'status']);
      expect(cloned.groupBy!.columns).toEqual(['category', 'status', 'type']);
    });

    it('should clone groupBy with having clause', () => {
      const original = new QueryModel();
      original.groupBy = {
        columns: ['category'],
        having: { condition: 'COUNT(*) > ?', parameters: [5] }
      };

      const cloned = original.clone();
      cloned.groupBy!.having!.parameters = [10];

      expect(original.groupBy!.having!.parameters).toEqual([5]);
      expect(cloned.groupBy!.having!.parameters).toEqual([10]);
    });

    it('should clone joins', () => {
      const original = new QueryModel();
      original.joins = [
        {
          type: 'INNER',
          table: 'Table1',
          on: 'condition1'
        },
        {
          type: 'LEFT',
          table: 'Table2',
          on: 'condition2'
        }
      ];

      const cloned = original.clone();
      cloned.joins![0].type = 'LEFT';

      expect(original.joins![0].type).toBe('INNER');
      expect(cloned.joins![0].type).toBe('LEFT');
    });

    it('should clone scalar properties', () => {
      const original = new QueryModel();
      original.limit = 10;
      original.offset = 5;
      original.distinct = true;
      original.from = 'CustomTable';

      const cloned = original.clone();

      expect(cloned.limit).toBe(10);
      expect(cloned.offset).toBe(5);
      expect(cloned.distinct).toBe(true);
      expect(cloned.from).toBe('CustomTable');
    });

    it('should clone unions recursively', () => {
      const original = new QueryModel();
      original.select = ['id'];

      const unionModel = new QueryModel();
      unionModel.select = ['name'];

      original.unions = [
        {
          all: true,
          other: unionModel,
          entity: class TestEntity {} as new () => unknown
        }
      ];

      const cloned = original.clone();
      cloned.unions![0].other.select!.push('value');

      expect(unionModel.select).toEqual(['name']);
      expect(cloned.unions![0].other.select).toEqual(['name', 'value']);
    });

    it('should handle nested unions', () => {
      const nestedModel = new QueryModel();
      nestedModel.select = ['nested'];

      const middleModel = new QueryModel();
      middleModel.select = ['middle'];
      middleModel.unions = [
        {
          all: false,
          other: nestedModel,
          entity: class Entity {} as new () => unknown
        }
      ];

      const original = new QueryModel();
      original.select = ['top'];
      original.unions = [
        {
          all: true,
          other: middleModel,
          entity: class Entity {} as new () => unknown
        }
      ];

      const cloned = original.clone();

      expect(cloned.unions![0].other.unions![0].other.select).toEqual(['nested']);
      expect(cloned.unions![0].other.unions![0].other).not.toBe(nestedModel);
    });

    it('should maintain union flags', () => {
      const original = new QueryModel();
      const other = new QueryModel();

      original.unions = [
        {
          all: true,
          other,
          entity: class E1 {} as new () => unknown
        },
        {
          all: false,
          other,
          entity: class E2 {} as new () => unknown
        }
      ];

      const cloned = original.clone();

      expect(cloned.unions![0].all).toBe(true);
      expect(cloned.unions![1].all).toBe(false);
    });

    it('should maintain entity references in unions', () => {
      class TestEntity {}
      class OtherEntity {}

      const original = new QueryModel();
      const other = new QueryModel();

      original.unions = [
        { all: false, other, entity: TestEntity as new () => unknown },
        { all: false, other, entity: OtherEntity as new () => unknown }
      ];

      const cloned = original.clone();

      expect(cloned.unions![0].entity).toBe(TestEntity);
      expect(cloned.unions![1].entity).toBe(OtherEntity);
    });
  });

  describe('immutability', () => {
    it('should allow modification of cloned model without affecting original', () => {
      const original = new QueryModel();
      original.select = ['id'];
      original.where = [{ condition: 'active = ?', parameters: [true] }];
      original.orderBy = [{ column: 'created', direction: 'DESC' }];
      original.limit = 10;

      const cloned = original.clone();
      cloned.select = ['name'];
      cloned.where = [];
      cloned.orderBy = [];
      cloned.limit = 20;

      expect(original.select).toEqual(['id']);
      expect(original.where).toHaveLength(1);
      expect(original.orderBy).toHaveLength(1);
      expect(original.limit).toBe(10);
    });

    it('should create independent copies of arrays', () => {
      const original = new QueryModel();
      original.select = ['a', 'b', 'c'];

      const clone1 = original.clone();
      const clone2 = original.clone();

      clone1.select!.push('d');
      clone2.select!.push('e');

      expect(original.select).toEqual(['a', 'b', 'c']);
      expect(clone1.select).toEqual(['a', 'b', 'c', 'd']);
      expect(clone2.select).toEqual(['a', 'b', 'c', 'e']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty arrays in clone', () => {
      const original = new QueryModel();
      original.select = [];
      original.where = [];
      original.orderBy = [];
      original.joins = [];

      const cloned = original.clone();

      expect(cloned.select).toEqual([]);
      expect(cloned.where).toEqual([]);
      expect(cloned.orderBy).toEqual([]);
      expect(cloned.joins).toEqual([]);
    });

    it('should handle zero values in clone', () => {
      const original = new QueryModel();
      original.limit = 0;
      original.offset = 0;

      const cloned = original.clone();

      expect(cloned.limit).toBe(0);
      expect(cloned.offset).toBe(0);
    });

    it('should handle false boolean in clone', () => {
      const original = new QueryModel();
      original.distinct = false;

      const cloned = original.clone();

      expect(cloned.distinct).toBe(false);
    });

    it('should handle empty parameters array in where clause', () => {
      const original = new QueryModel();
      original.where = [{ condition: 'id IS NOT NULL', parameters: [] }];

      const cloned = original.clone();

      expect(cloned.where![0].parameters).toEqual([]);
      expect(cloned.where![0].parameters).not.toBe(original.where![0].parameters);
    });

    it('should handle empty parameters array in having clause', () => {
      const original = new QueryModel();
      original.groupBy = {
        columns: ['category'],
        having: { condition: 'COUNT(*) > 0', parameters: [] }
      };

      const cloned = original.clone();

      expect(cloned.groupBy!.having!.parameters).toEqual([]);
      expect(cloned.groupBy!.having!.parameters).not.toBe(
        original.groupBy!.having!.parameters
      );
    });
  });
});
