import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityMetadata, QueryOptions } from '@ts-linq/types';

import { PostgresDialect } from '../../src/PostgresDialect';

class TestEntity {
  id!: number;
  name!: string;
}

describe('PostgresDialect', () => {
  let dialect: PostgresDialect;

  beforeEach(() => {
    dialect = new PostgresDialect();
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
    it('should build SELECT * with no options', () => {
      const options: QueryOptions = {};
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table"');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with specific columns', () => {
      const options: QueryOptions = {
        select: ['id', 'name']
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT id, name FROM "test_table"');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT DISTINCT', () => {
      const options: QueryOptions = {
        distinct: true,
        select: ['name']
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT DISTINCT name FROM "test_table"');
      expect(result.parameters).toEqual([]);
    });

    it('should use custom FROM clause when provided', () => {
      const options: QueryOptions = {
        from: 'custom_table'
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "custom_table"');
      expect(result.parameters).toEqual([]);
    });

    it('should throw error when entity metadata not found', () => {
      class UnknownEntity {}

      expect(() => dialect.buildSelect(UnknownEntity, {})).toThrow(
        'Entity metadata not found for UnknownEntity'
      );
    });
  });

  describe('buildSelect - WHERE clause with PostgreSQL parameters', () => {
    it('should build SELECT with single WHERE clause and convert ? to $1', () => {
      const options: QueryOptions = {
        where: { condition: 'id = ?', parameters: [1] }
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table" WHERE id = $1');
      expect(result.parameters).toEqual([1]);
    });

    it('should build SELECT with multiple WHERE clauses and convert ? to $1, $2', () => {
      const options: QueryOptions = {
        where: [
          { condition: 'id > ?', parameters: [10] },
          { condition: 'name LIKE ?', parameters: ['%test%'] }
        ]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table" WHERE id > $1 AND name LIKE $2');
      expect(result.parameters).toEqual([10, '%test%']);
    });

    it('should handle empty WHERE array', () => {
      const options: QueryOptions = {
        where: []
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table"');
      expect(result.parameters).toEqual([]);
    });

    it('should number placeholders correctly with multiple conditions', () => {
      const options: QueryOptions = {
        where: [
          { condition: 'a = ? AND b = ?', parameters: [1, 2] },
          { condition: 'c IN (?, ?)', parameters: [3, 4] }
        ]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe(
        'SELECT * FROM "test_table" WHERE a = $1 AND b = $2 AND c IN ($3, $4)'
      );
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
        'SELECT * FROM "test_table" INNER JOIN "orders" ON orders.user_id = test_table.id'
      );
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with LEFT JOIN and alias', () => {
      const options: QueryOptions = {
        joins: [{ type: 'LEFT', table: 'orders', alias: 'o', on: 'o.user_id = test_table.id' }]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe(
        'SELECT * FROM "test_table" LEFT JOIN "orders" AS o ON o.user_id = test_table.id'
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
        'SELECT * FROM "test_table" INNER JOIN "orders" AS o ON o.user_id = test_table.id LEFT JOIN "products" AS p ON p.id = o.product_id'
      );
      expect(result.parameters).toEqual([]);
    });

    it('renders structured onColumns with double-quote identifier quoting', () => {
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
        'SELECT * FROM "test_table" INNER JOIN "orders" ON "orders"."user_id" = "test_table"."id"'
      );
    });
  });

  describe('buildSelect - ORDER BY clause', () => {
    it('should build SELECT with ORDER BY ASC', () => {
      const options: QueryOptions = {
        orderBy: [{ column: 'name', direction: 'ASC' }]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table" ORDER BY name ASC');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with ORDER BY DESC', () => {
      const options: QueryOptions = {
        orderBy: [{ column: 'id', direction: 'DESC' }]
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table" ORDER BY id DESC');
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

      expect(result.query).toBe('SELECT * FROM "test_table" ORDER BY name ASC, id DESC');
      expect(result.parameters).toEqual([]);
    });
  });

  describe('buildSelect - GROUP BY clause', () => {
    it('should build SELECT with GROUP BY', () => {
      const options: QueryOptions = {
        groupBy: { columns: ['name'] }
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table" GROUP BY name');
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

      expect(result.query).toBe('SELECT * FROM "test_table" GROUP BY name HAVING COUNT(*) > $1');
      expect(result.parameters).toEqual([5]);
    });

    it('should build SELECT with GROUP BY multiple columns', () => {
      const options: QueryOptions = {
        groupBy: { columns: ['name', 'id'] }
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table" GROUP BY name, id');
      expect(result.parameters).toEqual([]);
    });

    it('should handle GROUP BY as array shorthand', () => {
      const options: QueryOptions = {
        groupBy: ['name', 'id']
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table" GROUP BY name, id');
      expect(result.parameters).toEqual([]);
    });
  });

  describe('buildSelect - LIMIT and OFFSET', () => {
    it('should build SELECT with LIMIT only', () => {
      const options: QueryOptions = {
        limit: 10
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table" LIMIT 10');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with LIMIT and OFFSET', () => {
      const options: QueryOptions = {
        limit: 10,
        offset: 20
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table" LIMIT 10 OFFSET 20');
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with OFFSET only', () => {
      const options: QueryOptions = {
        offset: 20
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table" OFFSET 20');
      expect(result.parameters).toEqual([]);
    });

    it('should handle LIMIT 0', () => {
      const options: QueryOptions = {
        limit: 0
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe('SELECT * FROM "test_table" LIMIT 0');
      expect(result.parameters).toEqual([]);
    });
  });

  describe('buildSelect - CTE (Common Table Expressions)', () => {
    it('should build SELECT with CTE', () => {
      const options: QueryOptions = {
        cte: {
          name: 'active_users',
          sql: 'SELECT * FROM users WHERE active = true'
        }
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe(
        'WITH active_users AS (SELECT * FROM users WHERE active = true) SELECT * FROM "test_table"'
      );
      expect(result.parameters).toEqual([]);
    });

    it('should build SELECT with CTE and WHERE clause', () => {
      const options: QueryOptions = {
        cte: {
          name: 'recent_orders',
          sql: "SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '1 day'"
        },
        where: { condition: 'id = ?', parameters: [1] }
      };
      const result = dialect.buildSelect(TestEntity, options);

      expect(result.query).toBe(
        'WITH recent_orders AS (SELECT * FROM orders WHERE created_at > NOW() - INTERVAL \'1 day\') SELECT * FROM "test_table" WHERE id = $1'
      );
      expect(result.parameters).toEqual([1]);
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
        'SELECT DISTINCT test_table.id, test_table.name, COUNT(o.id) AS order_count FROM "test_table" LEFT JOIN "orders" AS o ON o.user_id = test_table.id WHERE test_table.name LIKE $1 GROUP BY test_table.id, test_table.name ORDER BY order_count DESC LIMIT 10 OFFSET 5'
      );
      expect(result.parameters).toEqual(['%user%']);
    });

    it('should preserve parameter order and numbering across multiple clauses', () => {
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
      expect(result.query).toContain('$1');
      expect(result.query).toContain('$2');
      expect(result.query).toContain('$3');
      expect(result.query).toContain('$4');
    });
  });

  describe('quoteIdentifier', () => {
    it('should return identifier with double quotes', () => {
      expect(dialect.quoteIdentifier('tableName')).toBe('"tableName"');
      expect(dialect.quoteIdentifier('column')).toBe('"column"');
    });

    it('should escape double quotes in identifier by doubling them', () => {
      expect(dialect.quoteIdentifier('table"name')).toBe('"table""name"');
      expect(dialect.quoteIdentifier('col"umn')).toBe('"col""umn"');
    });
  });

  describe('quoteStringLiteral', () => {
    it('should wrap in single quotes and double embedded single quotes', () => {
      expect(dialect.quoteStringLiteral("o'brien")).toBe("'o''brien'");
      expect(dialect.quoteStringLiteral('plain')).toBe("'plain'");
    });
  });

  // task-3: Postgres CRUD hardcoded double quotes without escaping. It now routes through
  // quoteIdentifier, which doubles an embedded double quote so it cannot break out.
  describe('adversarial identifiers (task-3)', () => {
    const adversarialMeta: EntityMetadata = {
      tableName: 'tbl"evil',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'INT', nullable: false, primaryKey: true },
        { propertyName: 'weird', columnName: 'we"ird', type: 'TEXT', nullable: true }
      ],
      relationships: [],
      indexes: []
    };

    it('buildInsert escapes double quotes in table and column names', () => {
      const { sql } = dialect.buildInsert({ id: 1, weird: 'x' }, adversarialMeta);
      expect(sql).toContain('INSERT INTO "tbl""evil"');
      expect(sql).toContain('"we""ird"');
      expect(sql).not.toContain('INSERT INTO "tbl"evil"');
    });

    it('buildUpdate escapes double quotes in table and column names', () => {
      const { sql } = dialect.buildUpdate({ id: 1, weird: 'x' }, adversarialMeta);
      expect(sql).toContain('UPDATE "tbl""evil"');
      expect(sql).toContain('"we""ird" = $1');
      expect(sql).toContain('"id" = $2');
    });

    it('buildDelete escapes double quotes in table and column names', () => {
      const { sql } = dialect.buildDelete({ id: 1 }, adversarialMeta);
      expect(sql).toBe('DELETE FROM "tbl""evil" WHERE "id" = $1');
    });
  });

  describe('capabilities', () => {
    it('declares the true PostgreSQL capability matrix (no temporal support)', () => {
      expect(dialect.capabilities).toEqual({
        crud: true,
        batch: true,
        bulk: true,
        storedProcedures: true,
        temporal: false
      });
    });
  });
});
