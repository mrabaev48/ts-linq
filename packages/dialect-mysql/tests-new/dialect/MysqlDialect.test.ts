import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { MetadataStorage } from '@ts-linq/metadata';
import type { QueryOptions } from '@ts-linq/types';

import { MysqlDialect } from '../../src/MysqlDialect';

class TestEntity {
  id!: number;
  name!: string;
}

describe('MysqlDialect', () => {
  let dialect: MysqlDialect;

  beforeEach(() => {
    dialect = new MysqlDialect();
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(TestEntity, 'test_table');
    MetadataStorage.addColumn(TestEntity, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(TestEntity, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: true
    });
    MetadataStorage.addPrimaryKey(TestEntity, 'id');
  });

  afterEach(() => {
    MetadataStorage.getInstance().clear();
  });

  describe('buildSelect - basic queries', () => {
    it('should build SELECT * with backtick identifiers', () => {
      const options: QueryOptions = {};
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table`');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with specific columns', () => {
      const options: QueryOptions = {
        select: ['id', 'name']
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT id, name FROM `test_table`');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT DISTINCT', () => {
      const options: QueryOptions = {
        distinct: true,
        select: ['name']
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT DISTINCT name FROM `test_table`');
      expect(result.parameters).toEqual([]);
    });

    it('should use custom FROM clause when provided', () => {
      const options: QueryOptions = {
        from: 'custom_table'
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `custom_table`');
      expect(result.parameters).toEqual([]);
    });

    it('should throw error when entity metadata not found', () => {
      class UnknownEntity {}

      expect(() => dialect.buildSelect(UnknownEntity, {})).toThrow(
        'Entity metadata not found for UnknownEntity'
      );
    });
  });

  describe('buildSelect - WHERE clause with ? placeholders', () => {
    it('should build SELECT with single WHERE clause using ?', () => {
      const options: QueryOptions = {
        where: { condition: 'id = ?', parameters: [1] }
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` WHERE id = ?');
      expect(result.parameters).toEqual([1]);
    });

    it('should build SELECT with multiple WHERE clauses', () => {
      const options: QueryOptions = {
        where: [
          { condition: 'id > ?', parameters: [10] },
          { condition: 'name LIKE ?', parameters: ['%test%'] }
        ]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` WHERE id > ? AND name LIKE ?');
      expect(result.parameters).toEqual([10, '%test%']);
    });

    it('should handle empty WHERE array', () => {
      const options: QueryOptions = {
        where: []
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table`');
      expect(result.parameters).toEqual([]);
    });

    it('should preserve parameter order with multiple conditions', () => {
      const options: QueryOptions = {
        where: [
          { condition: 'a = ? AND b = ?', parameters: [1, 2] },
          { condition: 'c IN (?, ?)', parameters: [3, 4] }
        ]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` WHERE a = ? AND b = ? AND c IN (?, ?)');
      expect(result.parameters).toEqual([1, 2, 3, 4]);
    });
  });

  describe('buildSelect - JOIN clauses', () => {
    it('should build SELECT with INNER JOIN', () => {
      const options: QueryOptions = {
        joins: [{ type: 'INNER', table: 'orders', on: 'orders.user_id = test_table.id' }]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe(
        'SELECT * FROM `test_table` INNER JOIN `orders` ON orders.user_id = test_table.id'
      );
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with LEFT JOIN and alias', () => {
      const options: QueryOptions = {
        joins: [{ type: 'LEFT', table: 'orders', alias: 'o', on: 'o.user_id = test_table.id' }]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe(
        'SELECT * FROM `test_table` LEFT JOIN `orders` AS o ON o.user_id = test_table.id'
      );
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with multiple JOINs', () => {
      const options: QueryOptions = {
        joins: [
          { type: 'INNER', table: 'orders', alias: 'o', on: 'o.user_id = test_table.id' },
          { type: 'LEFT', table: 'products', alias: 'p', on: 'p.id = o.product_id' }
        ]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe(
        'SELECT * FROM `test_table` INNER JOIN `orders` AS o ON o.user_id = test_table.id LEFT JOIN `products` AS p ON p.id = o.product_id'
      );
      expect(result.parameters).toEqual([]);
    });

    it('renders structured onColumns with backtick identifier quoting', () => {
      const options: QueryOptions = {
        joins: [
          {
            type: 'INNER',
            table: 'orders',
            onColumns: [
              {
                left: { table: 'orders', column: 'user_id' },
                right: { table: 'test_table', column: 'id' }
              }
            ]
          }
        ]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe(
        'SELECT * FROM `test_table` INNER JOIN `orders` ON `orders`.`user_id` = `test_table`.`id`'
      );
    });
  });

  describe('buildSelect - ORDER BY clause', () => {
    it('should build SELECT with ORDER BY ASC', () => {
      const options: QueryOptions = {
        orderBy: [{ column: 'name', direction: 'ASC' }]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` ORDER BY name ASC');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with ORDER BY DESC', () => {
      const options: QueryOptions = {
        orderBy: [{ column: 'id', direction: 'DESC' }]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` ORDER BY id DESC');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with multiple ORDER BY columns', () => {
      const options: QueryOptions = {
        orderBy: [
          { column: 'name', direction: 'ASC' },
          { column: 'id', direction: 'DESC' }
        ]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` ORDER BY name ASC, id DESC');
      expect(result.parameters).toEqual([]);
    });
  });

  describe('buildSelect - GROUP BY clause', () => {
    it('should build SELECT with GROUP BY', () => {
      const options: QueryOptions = {
        groupBy: { columns: ['name'] }
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` GROUP BY name');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with GROUP BY and HAVING', () => {
      const options: QueryOptions = {
        groupBy: {
          columns: ['name'],
          having: { condition: 'COUNT(*) > ?', parameters: [5] }
        }
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` GROUP BY name HAVING COUNT(*) > ?');
      expect(result.parameters).toEqual([5]);
    });

    it('should build SELECT with GROUP BY multiple columns', () => {
      const options: QueryOptions = {
        groupBy: { columns: ['name', 'id'] }
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` GROUP BY name, id');
      expect(result.parameters).toEqual([]);
    });

    it('should handle GROUP BY as array shorthand', () => {
      const options: QueryOptions = {
        groupBy: ['name', 'id']
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` GROUP BY name, id');
      expect(result.parameters).toEqual([]);
    });
  });

  describe('buildSelect - LIMIT and OFFSET', () => {
    it('should build SELECT with LIMIT only', () => {
      const options: QueryOptions = {
        limit: 10
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` LIMIT 10');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with LIMIT and OFFSET', () => {
      const options: QueryOptions = {
        limit: 10,
        offset: 20
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` LIMIT 10 OFFSET 20');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with OFFSET only using large LIMIT value', () => {
      const options: QueryOptions = {
        offset: 20
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` LIMIT 18446744073709551615 OFFSET 20');
      expect(result.parameters).toEqual([]);
    });

    it('should handle LIMIT 0', () => {
      const options: QueryOptions = {
        limit: 0
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM `test_table` LIMIT 0');
      expect(result.parameters).toEqual([]);
    });
  });

  describe('buildSelect - complex combined queries', () => {
    it('should build SELECT with all clauses combined', () => {
      const options: QueryOptions = {
        distinct: true,
        select: ['test_table.id', 'test_table.name', 'COUNT(o.id) AS order_count'],
        joins: [{ type: 'LEFT', table: 'orders', alias: 'o', on: 'o.user_id = test_table.id' }],
        where: [{ condition: 'test_table.name LIKE ?', parameters: ['%user%'] }],
        groupBy: { columns: ['test_table.id', 'test_table.name'] },
        orderBy: [{ column: 'order_count', direction: 'DESC' }],
        limit: 10,
        offset: 5
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe(
        'SELECT DISTINCT test_table.id, test_table.name, COUNT(o.id) AS order_count FROM `test_table` LEFT JOIN `orders` AS o ON o.user_id = test_table.id WHERE test_table.name LIKE ? GROUP BY test_table.id, test_table.name ORDER BY order_count DESC LIMIT 10 OFFSET 5'
      );
      expect(result.parameters).toEqual(['%user%']);
    });

    it('should preserve parameter order across selectParams, WHERE, and HAVING', () => {
      const options: QueryOptions = {
        select: ['CASE WHEN id > ? THEN name ELSE NULL END'],
        selectParams: [100],
        where: [
          { condition: 'id > ?', parameters: [1] },
          { condition: 'name != ?', parameters: ['admin'] }
        ],
        groupBy: {
          columns: ['name'],
          having: { condition: 'COUNT(*) > ?', parameters: [5] }
        }
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.parameters).toEqual([100, 1, 'admin', 5]);
      const questionMarks = result.query.match(/\?/g);
      expect(questionMarks).toHaveLength(4);
    });
  });

  describe('quoteIdentifier', () => {
    it('should return identifier with backticks', () => {
      expect(dialect.quoteIdentifier('tableName')).toBe('`tableName`');
      expect(dialect.quoteIdentifier('column')).toBe('`column`');
    });

    it('should escape backticks in identifier by doubling them', () => {
      expect(dialect.quoteIdentifier('table`name')).toBe('`table``name`');
      expect(dialect.quoteIdentifier('col`umn')).toBe('`col``umn`');
    });
  });
});
