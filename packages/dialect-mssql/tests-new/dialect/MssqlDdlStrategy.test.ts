import { describe, it, expect, beforeEach } from '@jest/globals';
import { MssqlDdlStrategy } from '../../src/MssqlDdlStrategy';
import type { EntityMetadata, ColumnMetadata } from '@ts-linq/types';

describe('MssqlDdlStrategy', () => {
  let strategy: MssqlDdlStrategy;
  let mockLogger: { warn: jest.Mock };

  beforeEach(() => {
    mockLogger = { warn: jest.fn() };
    strategy = new MssqlDdlStrategy(mockLogger);
  });

  describe('generateCreateTableSql', () => {
    it('should generate CREATE TABLE with IF NOT EXISTS check', () => {
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

      expect(sql).toContain("IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')");
      expect(sql).toContain('CREATE TABLE users (id INT NOT NULL, name NVARCHAR(MAX))');
      expect(sql).toContain('BEGIN');
      expect(sql).toContain('END');
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

      expect(sql).toContain('PRIMARY KEY (id)');
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

      expect(sql).toContain('PRIMARY KEY (order_id, product_id)');
    });

    it('should throw error for missing columns', () => {
      const metadata = { tableName: 'test' } as EntityMetadata;

      expect(() => strategy.generateCreateTableSql(metadata)).toThrow(
        /Entity metadata is invalid or missing columns/
      );
    });

    it('should generate computed column (non-persisted by default)', () => {
      const metadata: EntityMetadata = {
        tableName: 'products',
        columns: [
          { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
          {
            propertyName: 'total',
            columnName: 'total',
            type: 'FLOAT',
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

      expect(sql).toContain('total AS (price * quantity)');
      expect(sql).not.toContain('PERSISTED');
    });

    it('should generate computed column (PERSISTED)', () => {
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
            computedStorage: 'PERSISTED'
          } as ColumnMetadata & { computedExpression?: string; computedStorage?: 'PERSISTED' }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: ['id']
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toContain('total AS (price * quantity) PERSISTED');
    });

    it('should emit warning for VIRTUAL/STORED computedStorage and use non-persisted', () => {
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
            computedStorage: 'VIRTUAL'
          } as ColumnMetadata & { computedExpression?: string; computedStorage?: 'VIRTUAL' }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: ['id']
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toContain('total AS (a + b)');
      expect(sql).not.toContain('PERSISTED');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("computedStorage='VIRTUAL' is not supported")
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

      expect(sql).toContain('PRIMARY KEY (unknownColumn)');
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

      expect(def).toBe('id INT NOT NULL');
    });

    it('should generate nullable column without NOT NULL', () => {
      const column: ColumnMetadata = {
        propertyName: 'name',
        columnName: 'name',
        type: 'TEXT',
        nullable: true
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('name NVARCHAR(MAX)');
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

      expect(def).toBe('code NVARCHAR(MAX)(50) NOT NULL');
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

      expect(def).toBe("status NVARCHAR(MAX) NOT NULL DEFAULT 'active'");
    });

    it('should generate column with defaultExpression', () => {
      const column: ColumnMetadata & { defaultExpression?: string } = {
        propertyName: 'created',
        columnName: 'created_at',
        type: 'DATETIME',
        nullable: false,
        defaultExpression: 'GETDATE()'
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('created_at DATETIME2 NOT NULL DEFAULT GETDATE()');
    });
  });

  describe('mapTypeToMssql', () => {
    it('should map TEXT types to NVARCHAR(MAX)', () => {
      expect(strategy.mapTypeToMssql('TEXT')).toBe('NVARCHAR(MAX)');
      expect(strategy.mapTypeToMssql('STRING')).toBe('NVARCHAR(MAX)');
      expect(strategy.mapTypeToMssql('text')).toBe('NVARCHAR(MAX)');
    });

    it('should map INTEGER types to INT', () => {
      expect(strategy.mapTypeToMssql('INTEGER')).toBe('INT');
      expect(strategy.mapTypeToMssql('NUMBER')).toBe('INT');
      expect(strategy.mapTypeToMssql('integer')).toBe('INT');
    });

    it('should map REAL/FLOAT/DOUBLE to FLOAT', () => {
      expect(strategy.mapTypeToMssql('REAL')).toBe('FLOAT');
      expect(strategy.mapTypeToMssql('FLOAT')).toBe('FLOAT');
      expect(strategy.mapTypeToMssql('DOUBLE')).toBe('FLOAT');
    });

    it('should map BOOLEAN to BIT', () => {
      expect(strategy.mapTypeToMssql('BOOLEAN')).toBe('BIT');
    });

    it('should map DATE types to DATETIME2', () => {
      expect(strategy.mapTypeToMssql('DATETIME')).toBe('DATETIME2');
      expect(strategy.mapTypeToMssql('DATE')).toBe('DATETIME2');
    });

    it('should map BLOB to VARBINARY(MAX)', () => {
      expect(strategy.mapTypeToMssql('BLOB')).toBe('VARBINARY(MAX)');
    });

    it('should map UUID to UNIQUEIDENTIFIER', () => {
      expect(strategy.mapTypeToMssql('UUID')).toBe('UNIQUEIDENTIFIER');
    });

    it('should default to NVARCHAR(MAX) for unknown types', () => {
      expect(strategy.mapTypeToMssql('UNKNOWN')).toBe('NVARCHAR(MAX)');
      expect(strategy.mapTypeToMssql('')).toBe('NVARCHAR(MAX)');
    });
  });

  describe('generateCreateIndexSql', () => {
    it('should generate basic index', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name',
        columns: ['name'],
        unique: false
      });

      expect(sql).toContain('CREATE INDEX');
      expect(sql).toContain('idx_users_name');
      expect(sql).toContain('ON users');
      expect(sql).toContain('(name)');
    });

    it('should generate unique index', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_email',
        columns: ['email'],
        unique: true
      });

      expect(sql).toContain('CREATE UNIQUE INDEX');
      expect(sql).toContain('idx_users_email');
    });

    it('should generate composite index', () => {
      const sql = strategy.generateCreateIndexSql('orders', {
        name: 'idx_orders_user_date',
        columns: ['user_id', 'created_at'],
        unique: false
      });

      expect(sql).toContain('user_id');
      expect(sql).toContain('created_at');
    });

    it('should generate index with column orders', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name_desc',
        columns: ['name'],
        unique: false,
        orders: { name: 'DESC' }
      });

      expect(sql).toContain('name DESC');
    });

    it('should generate index with INCLUDE columns', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name_inc',
        columns: ['name'],
        unique: false,
        include: ['email', 'phone']
      });

      expect(sql).toContain('INCLUDE');
      expect(sql).toContain('email');
      expect(sql).toContain('phone');
    });

    it('should generate index with WHERE clause (filtered index)', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_active_users',
        columns: ['email'],
        unique: false,
        where: 'is_active = 1'
      });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('is_active = 1');
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

    it('should emit warning for invalid index spec (no columns)', () => {
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
