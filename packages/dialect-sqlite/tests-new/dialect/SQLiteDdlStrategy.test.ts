import { describe, it, expect, beforeEach } from '@jest/globals';
import { SQLiteDdlStrategy } from '../../src/SQLiteDdlStrategy';
import type { EntityMetadata, ColumnMetadata } from '@ts-linq/types';

describe('SQLiteDdlStrategy', () => {
  let strategy: SQLiteDdlStrategy;
  let mockLogger: { warn: jest.Mock };

  beforeEach(() => {
    mockLogger = { warn: jest.fn() };
    strategy = new SQLiteDdlStrategy(mockLogger);
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

      expect(sql).toBe('CREATE TABLE IF NOT EXISTS users (id INTEGER NOT NULL, name TEXT)');
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
        'CREATE TABLE IF NOT EXISTS users (id INTEGER NOT NULL, name TEXT, PRIMARY KEY (id))'
      );
    });

    it('should generate CREATE TABLE with INTEGER AUTOINCREMENT for generated PK', () => {
      const metadata: EntityMetadata = {
        tableName: 'users',
        columns: [
          {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false,
            isGenerated: true
          },
          { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: true }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: ['id']
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toBe(
        'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)'
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
        'CREATE TABLE IF NOT EXISTS order_items (order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, PRIMARY KEY (order_id, product_id))'
      );
    });

    it('should throw error for invalid metadata', () => {
      const metadata = {} as EntityMetadata;

      expect(() => strategy.generateCreateTableSql(metadata)).toThrow(
        /Entity metadata is invalid or missing columns/
      );
    });

    it('should throw error for missing columns', () => {
      const metadata = { tableName: 'test' } as EntityMetadata;

      expect(() => strategy.generateCreateTableSql(metadata)).toThrow(
        /Entity metadata is invalid or missing columns/
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
        'CREATE TABLE IF NOT EXISTS users (id INTEGER NOT NULL, name TEXT, PRIMARY KEY (unknownColumn))'
      );
    });

    it('should emit warning for STORED computed column in CREATE TABLE', () => {
      const metadata: EntityMetadata = {
        tableName: 'calculations',
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

      strategy.generateCreateTableSql(metadata);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('STORED generated columns require SQLite >= 3.31')
      );
    });

    it('should emit warning for unsupported computedStorage in CREATE TABLE', () => {
      const metadata: EntityMetadata = {
        tableName: 'calculations',
        columns: [
          { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
          {
            propertyName: 'calculated',
            columnName: 'calculated',
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

      strategy.generateCreateTableSql(metadata);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("computedStorage='PERSISTED' is not supported")
      );
    });
  });

  describe('generateColumnDefinition', () => {
    it('should generate column definition with type', () => {
      const column: ColumnMetadata = {
        propertyName: 'name',
        columnName: 'name',
        type: 'TEXT',
        nullable: true
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('name TEXT');
    });

    it('should generate column definition with NOT NULL', () => {
      const column: ColumnMetadata = {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('id INTEGER NOT NULL');
    });

    it('should generate column definition with length', () => {
      const column: ColumnMetadata = {
        propertyName: 'code',
        columnName: 'code',
        type: 'TEXT',
        nullable: false,
        length: 50
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('code TEXT(50) NOT NULL');
    });

    it('should generate column definition with default value (number)', () => {
      const column: ColumnMetadata = {
        propertyName: 'status',
        columnName: 'status',
        type: 'INTEGER',
        nullable: false,
        defaultValue: 0
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('status INTEGER NOT NULL DEFAULT 0');
    });

    it('should generate column definition with default value (string)', () => {
      const column: ColumnMetadata = {
        propertyName: 'role',
        columnName: 'role',
        type: 'TEXT',
        nullable: false,
        defaultValue: 'user'
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe("role TEXT NOT NULL DEFAULT 'user'");
    });

    it('should generate column definition with default expression', () => {
      const column: ColumnMetadata & { defaultExpression?: string } = {
        propertyName: 'createdAt',
        columnName: 'created_at',
        type: 'TEXT',
        nullable: false,
        defaultExpression: "CURRENT_TIMESTAMP"
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');
    });

    it('should generate computed column (VIRTUAL)', () => {
      const column: ColumnMetadata & { computedExpression?: string; computedStorage?: 'VIRTUAL' } = {
        propertyName: 'fullName',
        columnName: 'full_name',
        type: 'TEXT',
        nullable: true,
        isComputed: true,
        computedExpression: "first_name || ' ' || last_name",
        computedStorage: 'VIRTUAL'
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe("full_name GENERATED ALWAYS AS (first_name || ' ' || last_name) VIRTUAL");
    });

    it('should generate computed column (STORED) with warning', () => {
      const column: ColumnMetadata & { computedExpression?: string; computedStorage?: 'STORED' } = {
        propertyName: 'total',
        columnName: 'total',
        type: 'REAL',
        nullable: true,
        isComputed: true,
        computedExpression: 'price * quantity',
        computedStorage: 'STORED'
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('total GENERATED ALWAYS AS (price * quantity) STORED');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('STORED generated columns require SQLite >= 3.31')
      );
    });

    it('should generate computed column with unsupported storage and warning', () => {
      const column: ColumnMetadata & {
        computedExpression?: string;
        computedStorage?: 'PERSISTED';
      } = {
        propertyName: 'calculated',
        columnName: 'calculated',
        type: 'INTEGER',
        nullable: true,
        isComputed: true,
        computedExpression: 'a + b',
        computedStorage: 'PERSISTED'
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('calculated GENERATED ALWAYS AS (a + b) VIRTUAL');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("computedStorage='PERSISTED' is not supported")
      );
    });

    it('should not add NOT NULL/DEFAULT for INTEGER AUTOINCREMENT', () => {
      const column: ColumnMetadata = {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false,
        isGenerated: true,
        defaultValue: 1
      };

      const def = strategy.generateColumnDefinition(column);

      expect(def).toBe('id INTEGER');
    });
  });

  describe('mapTypeToSQLite', () => {
    it('should map TEXT types', () => {
      expect(strategy.mapTypeToSQLite('TEXT')).toBe('TEXT');
      expect(strategy.mapTypeToSQLite('STRING')).toBe('TEXT');
      expect(strategy.mapTypeToSQLite('text')).toBe('TEXT');
    });

    it('should map INTEGER types', () => {
      expect(strategy.mapTypeToSQLite('INTEGER')).toBe('INTEGER');
      expect(strategy.mapTypeToSQLite('NUMBER')).toBe('INTEGER');
      expect(strategy.mapTypeToSQLite('integer')).toBe('INTEGER');
    });

    it('should map REAL types', () => {
      expect(strategy.mapTypeToSQLite('REAL')).toBe('REAL');
      expect(strategy.mapTypeToSQLite('FLOAT')).toBe('REAL');
      expect(strategy.mapTypeToSQLite('DOUBLE')).toBe('REAL');
    });

    it('should map BOOLEAN to INTEGER', () => {
      expect(strategy.mapTypeToSQLite('BOOLEAN')).toBe('INTEGER');
    });

    it('should map DATE types to TEXT', () => {
      expect(strategy.mapTypeToSQLite('DATETIME')).toBe('TEXT');
      expect(strategy.mapTypeToSQLite('DATE')).toBe('TEXT');
    });

    it('should map BLOB type', () => {
      expect(strategy.mapTypeToSQLite('BLOB')).toBe('BLOB');
    });

    it('should default to TEXT for unknown types', () => {
      expect(strategy.mapTypeToSQLite('UNKNOWN')).toBe('TEXT');
      expect(strategy.mapTypeToSQLite('')).toBe('TEXT');
    });
  });

  describe('generateCreateIndexSql', () => {
    it('should generate basic index', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name',
        columns: ['name'],
        unique: false
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS idx_users_name ON users (name)');
    });

    it('should generate unique index', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_email',
        columns: ['email'],
        unique: true
      });

      expect(sql).toBe('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email)');
    });

    it('should generate composite index', () => {
      const sql = strategy.generateCreateIndexSql('orders', {
        name: 'idx_orders_user_date',
        columns: ['user_id', 'created_at'],
        unique: false
      });

      expect(sql).toBe(
        'CREATE INDEX IF NOT EXISTS idx_orders_user_date ON orders (user_id, created_at)'
      );
    });

    it('should generate index with column orders', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name_desc',
        columns: ['name'],
        unique: false,
        orders: { name: 'DESC' }
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS idx_users_name_desc ON users (name DESC)');
    });

    it('should generate index with collations', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name_nocase',
        columns: ['name'],
        unique: false,
        collations: { name: 'NOCASE' }
      });

      expect(sql).toBe(
        'CREATE INDEX IF NOT EXISTS idx_users_name_nocase ON users (name COLLATE NOCASE)'
      );
    });

    it('should generate index with WHERE clause (partial index)', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_active_users',
        columns: ['email'],
        unique: false,
        where: 'is_active = 1'
      });

      expect(sql).toBe(
        'CREATE INDEX IF NOT EXISTS idx_active_users ON users (email) WHERE is_active = 1'
      );
    });

    it('should return empty for index with no columns and expressions', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_lower_email',
        columns: [],
        unique: false,
        expressions: []
      });

      expect(sql).toBe('');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should generate index with columns and expressions', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_mixed',
        columns: ['created_at'],
        unique: false,
        expressions: ['LOWER(email)']
      });

      expect(sql).toBe(
        'CREATE INDEX IF NOT EXISTS idx_users_mixed ON users (created_at, (LOWER(email)))'
      );
    });

    it('should return empty string for invalid index spec (missing name)', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: '',
        columns: ['name'],
        unique: false
      });

      expect(sql).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid index spec for <unnamed>')
      );
    });

    it('should return empty string for invalid index spec (no columns)', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_test',
        columns: [],
        unique: false
      });

      expect(sql).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid index spec for idx_test')
      );
    });
  });
});
