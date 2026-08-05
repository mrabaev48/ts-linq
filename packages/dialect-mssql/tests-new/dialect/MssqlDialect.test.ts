import { beforeEach, describe, expect, it } from '@jest/globals';
import type { EntityMetadata, QueryOptions } from '@ts-linq/types';

import { MssqlDialect } from '../../src/MssqlDialect';

class TestEntity {
  id!: number;
  name!: string;
}

// `buildSelect` takes metadata as a parameter, so this suite needs no global registry setup.
const testMeta: EntityMetadata = {
  tableName: 'test_table',
  primaryKeys: ['id'],
  columns: [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
    { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: true }
  ],
  relationships: [],
  indexes: []
};

describe('MssqlDialect', () => {
  let dialect: MssqlDialect;

  beforeEach(() => {
    dialect = new MssqlDialect();
  });

  describe('buildSelect - basic queries', () => {
    it('should build SELECT * with square bracket identifiers', () => {
      const options: QueryOptions = {};
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table]');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with specific columns', () => {
      const options: QueryOptions = {
        select: ['id', 'name']
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT id, name FROM [test_table]');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT DISTINCT', () => {
      const options: QueryOptions = {
        distinct: true,
        select: ['name']
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT DISTINCT name FROM [test_table]');
      expect(result.parameters).toEqual([]);
    });

    it('should use custom FROM clause when provided', () => {
      const options: QueryOptions = {
        from: 'custom_table'
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [custom_table]');
      expect(result.parameters).toEqual([]);
    });

    it('should throw error when entity metadata not found', () => {
      class UnknownEntity {}

      expect(() => dialect.buildSelect(UnknownEntity, {}, undefined)).toThrow(
        'Entity metadata not found for UnknownEntity'
      );
    });
  });

  describe('buildSelect - WHERE clause with @p placeholders', () => {
    it('should build SELECT with single WHERE clause converting ? to @p1', () => {
      const options: QueryOptions = {
        where: { condition: 'id = ?', parameters: [1] }
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table] WHERE id = @p1');
      expect(result.parameters).toEqual([1]);
    });

    it('should build SELECT with multiple WHERE clauses and convert to @p1, @p2', () => {
      const options: QueryOptions = {
        where: [
          { condition: 'id > ?', parameters: [10] },
          { condition: 'name LIKE ?', parameters: ['%test%'] }
        ]
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table] WHERE id > @p1 AND name LIKE @p2');
      expect(result.parameters).toEqual([10, '%test%']);
    });

    it('should handle empty WHERE array', () => {
      const options: QueryOptions = {
        where: []
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table]');
      expect(result.parameters).toEqual([]);
    });

    it('should number placeholders correctly with multiple conditions', () => {
      const options: QueryOptions = {
        where: [
          { condition: 'a = ? AND b = ?', parameters: [1, 2] },
          { condition: 'c IN (?, ?)', parameters: [3, 4] }
        ]
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe(
        'SELECT * FROM [test_table] WHERE a = @p1 AND b = @p2 AND c IN (@p3, @p4)'
      );
      expect(result.parameters).toEqual([1, 2, 3, 4]);
    });
  });

  describe('buildSelect - JOIN clauses', () => {
    it('should build SELECT with INNER JOIN', () => {
      const options: QueryOptions = {
        joins: [{ type: 'INNER', table: 'orders', on: 'orders.user_id = test_table.id' }]
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe(
        'SELECT * FROM [test_table] INNER JOIN [orders] ON orders.user_id = test_table.id'
      );
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with LEFT JOIN and alias', () => {
      const options: QueryOptions = {
        joins: [{ type: 'LEFT', table: 'orders', alias: 'o', on: 'o.user_id = test_table.id' }]
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe(
        'SELECT * FROM [test_table] LEFT JOIN [orders] AS o ON o.user_id = test_table.id'
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
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe(
        'SELECT * FROM [test_table] INNER JOIN [orders] AS o ON o.user_id = test_table.id LEFT JOIN [products] AS p ON p.id = o.product_id'
      );
      expect(result.parameters).toEqual([]);
    });

    it('renders structured onColumns with bracket identifier quoting', () => {
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
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe(
        'SELECT * FROM [test_table] INNER JOIN [orders] ON [orders].[user_id] = [test_table].[id]'
      );
    });
  });

  describe('buildSelect - ORDER BY clause', () => {
    it('should build SELECT with ORDER BY ASC', () => {
      const options: QueryOptions = {
        orderBy: [{ column: 'name', direction: 'ASC' }]
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table] ORDER BY name ASC');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with ORDER BY DESC', () => {
      const options: QueryOptions = {
        orderBy: [{ column: 'id', direction: 'DESC' }]
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table] ORDER BY id DESC');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with multiple ORDER BY columns', () => {
      const options: QueryOptions = {
        orderBy: [
          { column: 'name', direction: 'ASC' },
          { column: 'id', direction: 'DESC' }
        ]
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table] ORDER BY name ASC, id DESC');
      expect(result.parameters).toEqual([]);
    });
  });

  describe('buildSelect - GROUP BY clause', () => {
    it('should build SELECT with GROUP BY', () => {
      const options: QueryOptions = {
        groupBy: { columns: ['name'] }
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table] GROUP BY name');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with GROUP BY and HAVING', () => {
      const options: QueryOptions = {
        groupBy: {
          columns: ['name'],
          having: { condition: 'COUNT(*) > ?', parameters: [5] }
        }
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table] GROUP BY name HAVING COUNT(*) > @p1');
      expect(result.parameters).toEqual([5]);
    });

    it('should build SELECT with GROUP BY multiple columns', () => {
      const options: QueryOptions = {
        groupBy: { columns: ['name', 'id'] }
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table] GROUP BY name, id');
      expect(result.parameters).toEqual([]);
    });

    it('should handle GROUP BY as array shorthand', () => {
      const options: QueryOptions = {
        groupBy: ['name', 'id']
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table] GROUP BY name, id');
      expect(result.parameters).toEqual([]);
    });
  });

  describe('buildSelect - TOP, OFFSET and FETCH', () => {
    it('should build SELECT with TOP when limit without offset', () => {
      const options: QueryOptions = {
        limit: 10
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT TOP (10) * FROM [test_table]');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with OFFSET FETCH when both limit and offset', () => {
      const options: QueryOptions = {
        limit: 10,
        offset: 20
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe(
        'SELECT * FROM [test_table] ORDER BY (SELECT NULL) OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY'
      );
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with OFFSET only (no FETCH)', () => {
      const options: QueryOptions = {
        offset: 20
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table] ORDER BY (SELECT NULL) OFFSET 20 ROWS');
      expect(result.parameters).toEqual([]);
    });

    it('should not add ORDER BY (SELECT NULL) when OFFSET with existing ORDER BY', () => {
      const options: QueryOptions = {
        orderBy: [{ column: 'id', direction: 'ASC' }],
        offset: 20
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT * FROM [test_table] ORDER BY id ASC OFFSET 20 ROWS');
      expect(result.parameters).toEqual([]);
    });

    it('should handle TOP 0', () => {
      const options: QueryOptions = {
        limit: 0
      };
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe('SELECT TOP (0) * FROM [test_table]');
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
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.query).toBe(
        'SELECT DISTINCT test_table.id, test_table.name, COUNT(o.id) AS order_count FROM [test_table] LEFT JOIN [orders] AS o ON o.user_id = test_table.id WHERE test_table.name LIKE @p1 GROUP BY test_table.id, test_table.name ORDER BY order_count DESC OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY'
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
      const result = dialect.buildSelect(TestEntity, options, testMeta);

      expect(result.parameters).toEqual([100, 1, 'admin', 5]);
      expect(result.query).toContain('@p1');
      expect(result.query).toContain('@p2');
      expect(result.query).toContain('@p3');
      expect(result.query).toContain('@p4');
    });
  });

  describe('quoteIdentifier', () => {
    it('should return identifier with square brackets', () => {
      expect(dialect.quoteIdentifier('tableName')).toBe('[tableName]');
      expect(dialect.quoteIdentifier('column')).toBe('[column]');
    });

    it('should escape right brackets in identifier by doubling them', () => {
      expect(dialect.quoteIdentifier('table]name')).toBe('[table]]name]');
      expect(dialect.quoteIdentifier('col]umn')).toBe('[col]]umn]');
    });
  });

  describe('quoteStringLiteral', () => {
    it('should wrap in single quotes and double embedded single quotes', () => {
      expect(dialect.quoteStringLiteral("o'brien")).toBe("'o''brien'");
      expect(dialect.quoteStringLiteral('plain')).toBe("'plain'");
    });
  });

  // task-3: adversarial identifiers must not break out of the bracket-quoted context; a `]`
  // in a table/column name is escaped by doubling. Every DML path routes through quoteIdentifier.
  describe('adversarial identifiers (task-3)', () => {
    const adversarialMeta: EntityMetadata = {
      tableName: 'tbl]evil',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'INT', nullable: false, primaryKey: true },
        { propertyName: 'weird', columnName: 'we]ird', type: 'TEXT', nullable: true }
      ],
      relationships: [],
      indexes: []
    };

    it('buildInsert escapes brackets in table and column names', () => {
      const { sql } = dialect.buildInsert({ id: 1, weird: 'x' }, adversarialMeta);
      expect(sql).toContain('INSERT INTO [tbl]]evil]');
      expect(sql).toContain('[we]]ird]');
      // The raw, unescaped name must never leak into the statement.
      expect(sql).not.toContain('INSERT INTO tbl]evil');
    });

    it('buildUpdate escapes brackets in table and column names', () => {
      const { sql } = dialect.buildUpdate({ id: 1, weird: 'x' }, adversarialMeta);
      expect(sql).toContain('UPDATE [tbl]]evil]');
      expect(sql).toContain('[we]]ird] = @p1');
      expect(sql).toContain('[id] = @p2');
    });

    it('buildDelete escapes brackets in table and column names', () => {
      const { sql } = dialect.buildDelete({ id: 1 }, adversarialMeta);
      expect(sql).toBe('DELETE FROM [tbl]]evil] WHERE [id] = @p1');
    });
  });

  describe('capabilities', () => {
    it('declares the true SQL Server capability matrix (the only dialect with temporal support)', () => {
      expect(dialect.capabilities).toEqual({
        crud: true,
        batch: true,
        bulk: true,
        storedProcedures: true,
        temporal: true
      });
    });
  });
});
