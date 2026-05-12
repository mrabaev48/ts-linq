import { describe, it, expect, beforeEach } from '@jest/globals';
import { MySqlDdlStrategy } from '../../src/MySqlDdlStrategy';
import type { EntityMetadata, ColumnMetadata } from '@ts-linq/types';

describe('MySqlDdlStrategy', () => {
  let strategy: MySqlDdlStrategy;
  let mockLogger: { warn: jest.Mock };

  beforeEach(() => {
    mockLogger = { warn: jest.fn() };
    strategy = new MySqlDdlStrategy(mockLogger);
  });

  describe('generateCreateTableSql', () => {
    it('should generate CREATE TABLE with basic columns', () => {
      const metadata: EntityMetadata = {
        tableName: 'users',
        columns: [
          { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
          { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: true }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: []
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toBe('CREATE TABLE IF NOT EXISTS `users` (`id` INT NOT NULL, `name` TEXT)');
    });

    it('should generate CREATE TABLE with single primary key', () => {
      const metadata: EntityMetadata = {
        tableName: 'users',
        columns: [
          { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
          { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: true }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: ['id']
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toBe(
        'CREATE TABLE IF NOT EXISTS `users` (`id` INT NOT NULL, `name` TEXT, PRIMARY KEY (`id`))'
      );
    });

    it('should generate CREATE TABLE with composite primary key', () => {
      const metadata: EntityMetadata = {
        tableName: 'order_items',
        columns: [
          { propertyName: 'orderId', columnName: 'order_id', type: 'INTEGER', nullable: false },
          { propertyName: 'productId', columnName: 'product_id', type: 'INTEGER', nullable: false },
          { propertyName: 'quantity', columnName: 'quantity', type: 'INTEGER', nullable: false }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: ['orderId', 'productId']
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toBe(
        'CREATE TABLE IF NOT EXISTS `order_items` (`order_id` INT NOT NULL, `product_id` INT NOT NULL, `quantity` INT NOT NULL, PRIMARY KEY (`order_id`, `product_id`))'
      );
    });

    it('should throw error for missing columns', () => {
      const metadata = { tableName: 'test' } as EntityMetadata;

      expect(() => strategy.generateCreateTableSql(metadata)).toThrow(
        /Entity metadata is invalid or missing columns/
      );
    });

    it('should generate computed column (VIRTUAL by default)', () => {
      const metadata: EntityMetadata = {
        tableName: 'products',
        columns: [
          { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
          {
            propertyName: 'total',
            columnName: 'total',
            type: 'DOUBLE',
            nullable: true,
            isComputed: true,
            computedExpression: 'price * quantity'
          } as ColumnMetadata & { computedExpression?: string }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: ['id']
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toBe(
        'CREATE TABLE IF NOT EXISTS `products` (`id` INT NOT NULL, `total` DOUBLE GENERATED ALWAYS AS (price * quantity) VIRTUAL, PRIMARY KEY (`id`))'
      );
    });

    it('should generate computed column (STORED)', () => {
      const metadata: EntityMetadata = {
        tableName: 'products',
        columns: [
          { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
          {
            propertyName: 'total',
            columnName: 'total',
            type: 'REAL',
            nullable: true,
            isComputed: true,
            computedExpression: 'price * quantity',
            computedStorage: 'STORED'
          } as ColumnMetadata & { computedExpression?: string; computedStorage?: 'STORED' }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: ['id']
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toBe(
        'CREATE TABLE IF NOT EXISTS `products` (`id` INT NOT NULL, `total` DOUBLE GENERATED ALWAYS AS (price * quantity) STORED, PRIMARY KEY (`id`))'
      );
    });

    it('should emit warning for PERSISTED computedStorage and fall back to VIRTUAL', () => {
      const metadata: EntityMetadata = {
        tableName: 'calculations',
        columns: [
          { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
          {
            propertyName: 'total',
            columnName: 'total',
            type: 'INTEGER',
            nullable: true,
            isComputed: true,
            computedExpression: 'a + b',
            computedStorage: 'PERSISTED'
          } as ColumnMetadata & { computedExpression?: string; computedStorage?: 'PERSISTED' }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: ['id']
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toContain('GENERATED ALWAYS AS (a + b) VIRTUAL');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("computedStorage='PERSISTED' is not supported")
      );
    });

    it('should handle primary key referencing unknown column gracefully', () => {
      const metadata: EntityMetadata = {
        tableName: 'users',
        columns: [
          { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
          { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: true }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: ['unknownColumn']
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toBe(
        'CREATE TABLE IF NOT EXISTS `users` (`id` INT NOT NULL, `name` TEXT, PRIMARY KEY (`unknownColumn`))'
      );
    });
  });

  describe('generateColumnDefinition', () => {
    it('should generate column with type and NOT NULL', () => {
      const column: ColumnMetadata = {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('`id` INT NOT NULL');
    });

    it('should generate nullable column without NOT NULL', () => {
      const column: ColumnMetadata = {
        propertyName: 'name',
        columnName: 'name',
        type: 'TEXT',
        nullable: true
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('`name` TEXT');
    });

    it('should generate column with length', () => {
      const column: ColumnMetadata = {
        propertyName: 'code',
        columnName: 'code',
        type: 'TEXT',
        nullable: false,
        length: 50
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('`code` TEXT(50) NOT NULL');
    });

    it('should generate column with defaultValue', () => {
      const column: ColumnMetadata = {
        propertyName: 'status',
        columnName: 'status',
        type: 'TEXT',
        nullable: false,
        defaultValue: 'active'
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe("`status` TEXT NOT NULL DEFAULT 'active'");
    });

    it('should generate column with defaultExpression', () => {
      const column: ColumnMetadata & { defaultExpression?: string } = {
        propertyName: 'created',
        columnName: 'created_at',
        type: 'DATETIME',
        nullable: false,
        defaultExpression: 'NOW()'
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('`created_at` DATETIME NOT NULL DEFAULT NOW()');
    });
  });

  describe('mapTypeToMySql', () => {
    it('should map TEXT types', () => {
      expect(strategy.mapTypeToMySql('TEXT')).toBe('TEXT');
      expect(strategy.mapTypeToMySql('STRING')).toBe('TEXT');
      expect(strategy.mapTypeToMySql('text')).toBe('TEXT');
    });

    it('should map INTEGER types to INT', () => {
      expect(strategy.mapTypeToMySql('INTEGER')).toBe('INT');
      expect(strategy.mapTypeToMySql('NUMBER')).toBe('INT');
      expect(strategy.mapTypeToMySql('integer')).toBe('INT');
    });

    it('should map REAL/FLOAT/DOUBLE to DOUBLE', () => {
      expect(strategy.mapTypeToMySql('REAL')).toBe('DOUBLE');
      expect(strategy.mapTypeToMySql('FLOAT')).toBe('DOUBLE');
      expect(strategy.mapTypeToMySql('DOUBLE')).toBe('DOUBLE');
    });

    it('should map BOOLEAN to TINYINT(1)', () => {
      expect(strategy.mapTypeToMySql('BOOLEAN')).toBe('TINYINT(1)');
    });

    it('should map DATE types to DATETIME', () => {
      expect(strategy.mapTypeToMySql('DATETIME')).toBe('DATETIME');
      expect(strategy.mapTypeToMySql('DATE')).toBe('DATETIME');
    });

    it('should map BLOB type', () => {
      expect(strategy.mapTypeToMySql('BLOB')).toBe('BLOB');
    });

    it('should default to TEXT for unknown types', () => {
      expect(strategy.mapTypeToMySql('UNKNOWN')).toBe('TEXT');
      expect(strategy.mapTypeToMySql('')).toBe('TEXT');
    });
  });

  describe('generateCreateIndexSql', () => {
    it('should generate basic index', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name',
        columns: ['name'],
        unique: false
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS `idx_users_name` ON `users` (`name`)');
    });

    it('should generate unique index', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_email',
        columns: ['email'],
        unique: true
      });

      expect(sql).toBe('CREATE UNIQUE INDEX IF NOT EXISTS `idx_users_email` ON `users` (`email`)');
    });

    it('should generate composite index', () => {
      const sql = strategy.generateCreateIndexSql('orders', {
        name: 'idx_orders_user_date',
        columns: ['user_id', 'created_at'],
        unique: false
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS `idx_orders_user_date` ON `orders` (`user_id`, `created_at`)');
    });

    it('should generate index with column orders', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name_desc',
        columns: ['name'],
        unique: false,
        orders: { name: 'DESC' }
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS `idx_users_name_desc` ON `users` (`name` DESC)');
    });

    it('should generate FULLTEXT index', () => {
      const sql = strategy.generateCreateIndexSql('articles', {
        name: 'idx_articles_content',
        columns: ['title', 'body'],
        unique: false,
        mysqlType: 'FULLTEXT'
      });

      expect(sql).toContain('CREATE FULLTEXT INDEX');
      expect(sql).toContain('idx_articles_content');
    });

    it('should generate SPATIAL index', () => {
      const sql = strategy.generateCreateIndexSql('locations', {
        name: 'idx_locations_coords',
        columns: ['coordinates'],
        unique: false,
        mysqlType: 'SPATIAL'
      });

      expect(sql).toContain('CREATE SPATIAL INDEX');
      expect(sql).toContain('idx_locations_coords');
    });

    it('should generate index with INVISIBLE visibility', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_temp',
        columns: ['temp_field'],
        unique: false,
        mysqlVisibility: 'INVISIBLE'
      });

      expect(sql).toContain('INVISIBLE');
    });

    it('should generate index with VISIBLE visibility', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_active',
        columns: ['active'],
        unique: false,
        mysqlVisibility: 'VISIBLE'
      });

      expect(sql).toContain('VISIBLE');
    });

    it('should generate index with expression', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_lower_email',
        columns: [],
        unique: false,
        expressions: ['LOWER(email)']
      });

      expect(sql).toContain('(LOWER(email))');
    });

    it('should emit warning for invalid index spec (missing name)', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: '',
        columns: ['name'],
        unique: false
      });

      expect(sql).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid index spec')
      );
    });

    it('should emit warning for invalid index spec (no columns and no expressions)', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_test',
        columns: [],
        unique: false
      });

      expect(sql).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid index spec')
      );
    });
  });
});
