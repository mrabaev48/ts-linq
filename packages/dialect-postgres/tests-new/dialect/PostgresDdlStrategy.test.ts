import { describe, it, expect, beforeEach } from '@jest/globals';
import { PostgresDdlStrategy } from '../../src/PostgresDdlStrategy';
import type { EntityMetadata, ColumnMetadata } from '@ts-linq/types';

describe('PostgresDdlStrategy', () => {
  let strategy: PostgresDdlStrategy;
  let mockLogger: { warn: jest.Mock };

  beforeEach(() => {
    mockLogger = { warn: jest.fn() };
    strategy = new PostgresDdlStrategy(mockLogger);
  });

  describe('generateCreateTableSql', () => {
    it('should generate CREATE TABLE with basic columns and quoted identifiers', () => {
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

      expect(sql).toBe('CREATE TABLE IF NOT EXISTS "users" ("id" INTEGER NOT NULL, "name" TEXT)');
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
        'CREATE TABLE IF NOT EXISTS "users" ("id" INTEGER NOT NULL, "name" TEXT, PRIMARY KEY ("id"))'
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
        'CREATE TABLE IF NOT EXISTS "order_items" ("order_id" INTEGER NOT NULL, "product_id" INTEGER NOT NULL, "quantity" INTEGER NOT NULL, PRIMARY KEY ("order_id", "product_id"))'
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
        'CREATE TABLE IF NOT EXISTS "products" ("id" INTEGER NOT NULL, "total" DOUBLE PRECISION GENERATED ALWAYS AS (price * quantity) STORED, PRIMARY KEY ("id"))'
      );
    });

    it('should emit warning for VIRTUAL computedStorage and coerce to STORED', () => {
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
            computedStorage: 'VIRTUAL'
          } as ColumnMetadata & { computedExpression?: string; computedStorage?: 'VIRTUAL' }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: ['id']
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toContain('GENERATED ALWAYS AS (a + b) STORED');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("computedStorage='VIRTUAL' is not supported")
      );
    });

    it('should emit warning for PERSISTED computedStorage and coerce to STORED', () => {
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
            computedExpression: 'price * 1.1',
            computedStorage: 'PERSISTED'
          } as ColumnMetadata & { computedExpression?: string; computedStorage?: 'PERSISTED' }
        ],
        relationships: [],
        indexes: [],
        primaryKeys: ['id']
      };

      const sql = strategy.generateCreateTableSql(metadata);

      expect(sql).toContain('GENERATED ALWAYS AS (price * 1.1) STORED');
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
        'CREATE TABLE IF NOT EXISTS "users" ("id" INTEGER NOT NULL, "name" TEXT, PRIMARY KEY ("unknownColumn"))'
      );
    });
  });

  describe('mapTypeToPg', () => {
    it('should map TEXT types', () => {
      expect(strategy.mapTypeToPg('TEXT')).toBe('TEXT');
      expect(strategy.mapTypeToPg('STRING')).toBe('TEXT');
      expect(strategy.mapTypeToPg('text')).toBe('TEXT');
    });

    it('should map INTEGER types', () => {
      expect(strategy.mapTypeToPg('INTEGER')).toBe('INTEGER');
      expect(strategy.mapTypeToPg('NUMBER')).toBe('INTEGER');
      expect(strategy.mapTypeToPg('integer')).toBe('INTEGER');
    });

    it('should map REAL/FLOAT/DOUBLE to DOUBLE PRECISION', () => {
      expect(strategy.mapTypeToPg('REAL')).toBe('DOUBLE PRECISION');
      expect(strategy.mapTypeToPg('FLOAT')).toBe('DOUBLE PRECISION');
      expect(strategy.mapTypeToPg('DOUBLE')).toBe('DOUBLE PRECISION');
    });

    it('should map BOOLEAN type', () => {
      expect(strategy.mapTypeToPg('BOOLEAN')).toBe('BOOLEAN');
    });

    it('should map DATE types to TIMESTAMPTZ', () => {
      expect(strategy.mapTypeToPg('DATETIME')).toBe('TIMESTAMPTZ');
      expect(strategy.mapTypeToPg('DATE')).toBe('TIMESTAMPTZ');
    });

    it('should map BLOB to BYTEA', () => {
      expect(strategy.mapTypeToPg('BLOB')).toBe('BYTEA');
    });

    it('should map UUID type', () => {
      expect(strategy.mapTypeToPg('UUID')).toBe('UUID');
    });

    it('should map JSONB and JSON types', () => {
      expect(strategy.mapTypeToPg('JSONB')).toBe('JSONB');
      expect(strategy.mapTypeToPg('JSON')).toBe('JSON');
    });

    it('should default to TEXT for unknown types', () => {
      expect(strategy.mapTypeToPg('UNKNOWN')).toBe('TEXT');
      expect(strategy.mapTypeToPg('')).toBe('TEXT');
    });
  });

  describe('generateCreateIndexSql', () => {
    it('should generate basic index with quoted identifiers', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name',
        columns: ['name'],
        unique: false
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_users_name" ON "users" ("name")');
    });

    it('should generate unique index', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_email',
        columns: ['email'],
        unique: true
      });

      expect(sql).toBe('CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email")');
    });

    it('should generate composite index', () => {
      const sql = strategy.generateCreateIndexSql('orders', {
        name: 'idx_orders_user_date',
        columns: ['user_id', 'created_at'],
        unique: false
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_orders_user_date" ON "orders" ("user_id", "created_at")');
    });

    it('should generate index with column orders', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name_desc',
        columns: ['name'],
        unique: false,
        orders: { name: 'DESC' }
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_users_name_desc" ON "users" ("name" DESC)');
    });

    it('should generate index with NULLS FIRST/LAST', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name_nulls',
        columns: ['name'],
        unique: false,
        nulls: { name: 'LAST' }
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_users_name_nulls" ON "users" ("name" NULLS LAST)');
    });

    it('should generate index with WHERE clause (partial index)', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_active_users',
        columns: ['email'],
        unique: false,
        where: 'is_active = true'
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_active_users" ON "users" ("email") WHERE is_active = true');
    });

    it('should generate index with USING method', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_tags',
        columns: ['tags'],
        unique: false,
        using: 'gin'
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_users_tags" ON "users" USING GIN ("tags")');
    });

    it('should generate CONCURRENT index', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_email_concurrent',
        columns: ['email'],
        unique: false,
        concurrently: true
      });

      expect(sql).toBe('CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_users_email_concurrent" ON "users" ("email")');
    });

    it('should generate index with expression', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_lower_email',
        columns: [],
        unique: false,
        expressions: ['LOWER(email)']
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_users_lower_email" ON "users" ((LOWER(email)))');
    });

    it('should generate index with WITH parameters', () => {
      const sql = strategy.generateCreateIndexSql('users', {
        name: 'idx_users_name_fillfactor',
        columns: ['name'],
        unique: false,
        withParams: { fillfactor: 70 }
      });

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_users_name_fillfactor" ON "users" ("name") WITH (fillfactor=70)');
    });

    it('should generate index with multiple features combined', () => {
      const sql = strategy.generateCreateIndexSql('orders', {
        name: 'idx_orders_complex',
        columns: ['user_id', 'created_at'],
        unique: true,
        using: 'btree',
        orders: { created_at: 'DESC' },
        nulls: { created_at: 'LAST' },
        where: 'status = \'active\'',
        withParams: { fillfactor: 80 }
      });

      expect(sql).toContain('CREATE UNIQUE INDEX');
      expect(sql).toContain('USING BTREE');
      expect(sql).toContain('"created_at" DESC NULLS LAST');
      expect(sql).toContain("WHERE status = 'active'");
      expect(sql).toContain('WITH (fillfactor=80)');
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

    it('should return empty string for invalid index spec (no columns and no expressions)', () => {
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
