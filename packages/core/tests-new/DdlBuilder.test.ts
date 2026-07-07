import type { EntityMetadata } from '@ts-linq/types';

import { DdlBuilder } from '../src/DdlBuilder';
import type { DdlStrategy } from '../src/DdlStrategy';

describe('DdlBuilder', () => {
  let mockStrategy: jest.Mocked<DdlStrategy>;
  let builder: DdlBuilder;

  beforeEach(() => {
    mockStrategy = {
      generateCreateTableSql: jest.fn(),
      generateColumnDefinition: jest.fn(),
      generateCreateIndexSql: jest.fn(),
      generateAddColumnSql: jest.fn(),
      generateDropColumnSql: jest.fn(),
      generateAlterColumnTypeSql: jest.fn(),
      generateRenameTableSql: jest.fn(),
      generateForeignKeySql: jest.fn(),
      generateAddUniqueConstraintSql: jest.fn(),
      generateDropUniqueConstraintSql: jest.fn(),
      generateCommentSql: jest.fn()
    } as jest.Mocked<DdlStrategy>;

    builder = new DdlBuilder(mockStrategy);
  });

  describe('buildCreateTableSql()', () => {
    it('should delegate to strategy.generateCreateTableSql()', () => {
      const metadata: EntityMetadata = {
        target: class User {},
        tableName: 'users',
        columns: [
          {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false,
            isGenerated: true,
            isVersion: false
          }
        ],
        primaryKeys: ['id'],
        relationships: [],
        indexes: [],
        validations: []
      };

      mockStrategy.generateCreateTableSql.mockReturnValue(
        'CREATE TABLE users (id INTEGER PRIMARY KEY)'
      );

      const result = builder.buildCreateTableSql(metadata);

      expect(mockStrategy.generateCreateTableSql).toHaveBeenCalledWith(metadata);
      expect(result).toBe('CREATE TABLE users (id INTEGER PRIMARY KEY)');
    });

    it('should handle complex table with multiple columns', () => {
      const metadata: EntityMetadata = {
        target: class Product {},
        tableName: 'products',
        columns: [
          {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false,
            isGenerated: true,
            isVersion: false
          },
          {
            propertyName: 'name',
            columnName: 'name',
            type: 'VARCHAR',
            nullable: false,
            isGenerated: false,
            isVersion: false,
            length: 255
          },
          {
            propertyName: 'price',
            columnName: 'price',
            type: 'DECIMAL',
            nullable: false,
            isGenerated: false,
            isVersion: false,
            precision: 10,
            scale: 2
          }
        ],
        primaryKeys: ['id'],
        relationships: [],
        indexes: [],
        validations: []
      };

      mockStrategy.generateCreateTableSql.mockReturnValue(
        'CREATE TABLE products (id INTEGER PRIMARY KEY, name VARCHAR(255) NOT NULL, price DECIMAL(10,2) NOT NULL)'
      );

      const result = builder.buildCreateTableSql(metadata);

      expect(result).toContain('products');
      expect(mockStrategy.generateCreateTableSql).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildCreateIndexesSql()', () => {
    it('should return empty array when no indexes defined', () => {
      const metadata: EntityMetadata = {
        target: class User {},
        tableName: 'users',
        columns: [],
        primaryKeys: [],
        relationships: [],
        indexes: [],
        validations: []
      };

      const result = builder.buildCreateIndexesSql(metadata);

      expect(result).toEqual([]);
      expect(mockStrategy.generateCreateIndexSql).not.toHaveBeenCalled();
    });

    it('should generate SQL for single index', () => {
      const metadata: EntityMetadata = {
        target: class User {},
        tableName: 'users',
        columns: [],
        primaryKeys: [],
        relationships: [],
        indexes: [
          {
            name: 'idx_email',
            columns: ['email'],
            unique: true
          }
        ],
        validations: []
      };

      mockStrategy.generateCreateIndexSql.mockReturnValue(
        'CREATE UNIQUE INDEX idx_email ON users (email)'
      );

      const result = builder.buildCreateIndexesSql(metadata);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('CREATE UNIQUE INDEX idx_email ON users (email)');
      expect(mockStrategy.generateCreateIndexSql).toHaveBeenCalledWith('users', {
        name: 'idx_email',
        columns: ['email'],
        unique: true
      });
    });

    it('should generate SQL for multiple indexes', () => {
      const metadata: EntityMetadata = {
        target: class Product {},
        tableName: 'products',
        columns: [],
        primaryKeys: [],
        relationships: [],
        indexes: [
          {
            name: 'idx_name',
            columns: ['name'],
            unique: false
          },
          {
            name: 'idx_category_price',
            columns: ['category', 'price'],
            unique: false
          }
        ],
        validations: []
      };

      mockStrategy.generateCreateIndexSql
        .mockReturnValueOnce('CREATE INDEX idx_name ON products (name)')
        .mockReturnValueOnce('CREATE INDEX idx_category_price ON products (category, price)');

      const result = builder.buildCreateIndexesSql(metadata);

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('idx_name');
      expect(result[1]).toContain('idx_category_price');
      expect(mockStrategy.generateCreateIndexSql).toHaveBeenCalledTimes(2);
    });

    it('should handle index without explicit unique flag (defaults to false)', () => {
      const metadata: EntityMetadata = {
        target: class User {},
        tableName: 'users',
        columns: [],
        primaryKeys: [],
        relationships: [],
        indexes: [
          {
            name: 'idx_created',
            columns: ['createdAt']
          }
        ],
        validations: []
      };

      mockStrategy.generateCreateIndexSql.mockReturnValue(
        'CREATE INDEX idx_created ON users (createdAt)'
      );

      const result = builder.buildCreateIndexesSql(metadata);

      expect(mockStrategy.generateCreateIndexSql).toHaveBeenCalledWith('users', {
        name: 'idx_created',
        columns: ['createdAt'],
        unique: false
      });
    });
  });

  describe('buildAll()', () => {
    it('should return both table SQL and index SQLs', () => {
      const metadata: EntityMetadata = {
        target: class User {},
        tableName: 'users',
        columns: [
          {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false,
            isGenerated: true,
            isVersion: false
          }
        ],
        primaryKeys: ['id'],
        relationships: [],
        indexes: [
          {
            name: 'idx_email',
            columns: ['email'],
            unique: true
          }
        ],
        validations: []
      };

      mockStrategy.generateCreateTableSql.mockReturnValue('CREATE TABLE users (id INTEGER)');
      mockStrategy.generateCreateIndexSql.mockReturnValue(
        'CREATE UNIQUE INDEX idx_email ON users (email)'
      );

      const result = builder.buildAll(metadata);

      expect(result).toHaveProperty('tableSql');
      expect(result).toHaveProperty('indexSqls');
      expect(result.tableSql).toBe('CREATE TABLE users (id INTEGER)');
      expect(result.indexSqls).toHaveLength(1);
      expect(result.indexSqls[0]).toContain('idx_email');
    });

    it('should return empty index array when no indexes', () => {
      const metadata: EntityMetadata = {
        target: class Product {},
        tableName: 'products',
        columns: [],
        primaryKeys: [],
        relationships: [],
        indexes: [],
        validations: []
      };

      mockStrategy.generateCreateTableSql.mockReturnValue('CREATE TABLE products ()');

      const result = builder.buildAll(metadata);

      expect(result.tableSql).toBe('CREATE TABLE products ()');
      expect(result.indexSqls).toEqual([]);
    });
  });
});
