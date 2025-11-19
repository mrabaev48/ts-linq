import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SQLiteProvider } from '../src/SQLiteProvider';
import { MetadataStorage } from '@ts-linq/metadata';
import {
  DatabaseError,
  UniqueConstraintError,
  ForeignKeyConstraintError,
  OptimisticConcurrencyError
} from '@ts-linq/types';
import type { EntityMetadata } from '@ts-linq/types';

// Mock sqlite3 module
const mockRun = jest.fn<(sql: string, params: unknown, cb: (this: { changes: number }, err: Error | null) => void) => void>();
const mockAll = jest.fn<(sql: string, params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => void>();
const mockClose = jest.fn<(cb: (err?: Error | null) => void) => void>();
const mockDatabase = {
  run: mockRun,
  all: mockAll,
  close: mockClose
};

jest.mock('sqlite3', () => ({
  Database: jest.fn((connectionString: string, cb: (err?: Error | null) => void) => {
    setTimeout(() => cb(null), 0);
    return mockDatabase;
  })
}), { virtual: true });

describe('SQLiteProvider', () => {
  let provider: SQLiteProvider;
  let mockLogger: {
    query?: jest.Mock;
    transactionStart?: jest.Mock;
    transactionEnd?: jest.Mock;
  };

  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    mockLogger = {
      query: jest.fn(),
      transactionStart: jest.fn(),
      transactionEnd: jest.fn()
    };
    provider = new SQLiteProvider(':memory:', mockLogger as unknown as typeof mockLogger);
    
    // Reset mocks
    mockRun.mockClear();
    mockAll.mockClear();
    mockClose.mockClear();
  });

  afterEach(async () => {
    if (provider && (provider as unknown as { isConnected: boolean }).isConnected) {
      mockClose.mockImplementation((cb) => setTimeout(() => cb(null), 0));
      await provider.disconnect();
    }
    MetadataStorage.getInstance().clear();
  });

  describe('connect', () => {
    it('should establish connection and enable foreign keys', async () => {
      await provider.connect();

      expect(mockRun).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
    });

    it('should set isConnected to true after successful connection', async () => {
      await provider.connect();

      expect((provider as unknown as { isConnected: boolean }).isConnected).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should close database connection and set isConnected to false', async () => {
      await provider.connect();
      mockClose.mockImplementation((cb) => setTimeout(() => cb(null), 0));

      await provider.disconnect();

      expect(mockClose).toHaveBeenCalled();
      expect((provider as unknown as { isConnected: boolean }).isConnected).toBe(false);
    });

    it('should resolve even when database is not connected', async () => {
      await expect(provider.disconnect()).resolves.toBeUndefined();
    });

    it('should reject when close fails', async () => {
      await provider.connect();
      const closeError = new Error('Close failed');
      mockClose.mockImplementation((cb) => setTimeout(() => cb(closeError), 0));

      await expect(provider.disconnect()).rejects.toThrow('Close failed');
    });
  });

  describe('createTable', () => {
    it('should execute CREATE TABLE SQL from DDL strategy', async () => {
      await provider.connect();

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

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, null), 0);
      });

      await provider.createTable(metadata);

      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE'),
        expect.anything(),
        expect.any(Function)
      );
    });

    it('should create indexes after creating table', async () => {
      await provider.connect();

      const metadata: EntityMetadata = {
        tableName: 'users',
        columns: [
          { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
          { propertyName: 'email', columnName: 'email', type: 'TEXT', nullable: false }
        ],
        relationships: [],
        indexes: [
          { name: 'idx_email', columns: ['email'], unique: true }
        ],
        primaryKeys: ['id']
      };

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, null), 0);
      });

      await provider.createTable(metadata);

      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('CREATE UNIQUE INDEX'),
        expect.anything(),
        expect.any(Function)
      );
    });
  });

  describe('insert', () => {
    beforeEach(() => {
      class TestEntity {
        id!: number;
        name!: string;
      }

      MetadataStorage.addEntity(TestEntity, 'test_table');
      MetadataStorage.addColumn(TestEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true });
      MetadataStorage.addColumn(TestEntity, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false });
      MetadataStorage.addPrimaryKey(TestEntity, 'id');
    });

    it('should execute INSERT and retrieve generated ID for autoincrement column', async () => {
      class TestEntity {
        id!: number;
        name!: string;
      }

      await provider.connect();

      const entity = new TestEntity();
      entity.name = 'Test User';

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 1 }, null), 0);
      });

      mockAll.mockImplementation((sql, params, cb) => {
        if (sql.includes('last_insert_rowid')) {
          setTimeout(() => cb(null, [{ id: 42 }]), 0);
        } else {
          setTimeout(() => cb(null, []), 0);
        }
      });

      const result = await provider.insert(entity, TestEntity);

      expect(result.id).toBe(42);
      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining(['Test User']),
        expect.any(Function)
      );
    });

    it('should throw error when entity metadata not found', async () => {
      class UnknownEntity {}

      await provider.connect();

      await expect(provider.insert(new UnknownEntity(), UnknownEntity)).rejects.toThrow(
        'Entity metadata not found for UnknownEntity'
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      class TestEntity {
        id!: number;
        name!: string;
        version?: number;
      }

      MetadataStorage.addEntity(TestEntity, 'test_table');
      MetadataStorage.addColumn(TestEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false });
      MetadataStorage.addColumn(TestEntity, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false });
      MetadataStorage.addColumn(TestEntity, { propertyName: 'version', columnName: 'version', type: 'INTEGER', nullable: true, isVersion: true });
      MetadataStorage.addPrimaryKey(TestEntity, 'id');
    });

    it('should execute UPDATE and increment version when version column exists', async () => {
      class TestEntity {
        id!: number;
        name!: string;
        version?: number;
      }

      await provider.connect();

      const entity = new TestEntity();
      entity.id = 1;
      entity.name = 'Updated Name';
      entity.version = 5;

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 1 }, null), 0);
      });

      const result = await provider.update(entity, TestEntity);

      expect(result.version).toBe(6);
      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['Updated Name']),
        expect.any(Function)
      );
    });

    it('should throw OptimisticConcurrencyError when version mismatch (0 rows affected)', async () => {
      class TestEntity {
        id!: number;
        name!: string;
        version?: number;
      }

      await provider.connect();

      const entity = new TestEntity();
      entity.id = 1;
      entity.name = 'Updated Name';
      entity.version = 5;

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, null), 0);
      });

      await expect(provider.update(entity, TestEntity)).rejects.toThrow(OptimisticConcurrencyError);
    });

    it('should throw generic error when 0 rows affected and no version column', async () => {
      class SimpleEntity {
        id!: number;
        name!: string;
      }

      MetadataStorage.getInstance().clear();
      MetadataStorage.addEntity(SimpleEntity, 'simple_table');
      MetadataStorage.addColumn(SimpleEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false });
      MetadataStorage.addColumn(SimpleEntity, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false });
      MetadataStorage.addPrimaryKey(SimpleEntity, 'id');

      await provider.connect();

      const entity = new SimpleEntity();
      entity.id = 999;
      entity.name = 'Not Exists';

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, null), 0);
      });

      await expect(provider.update(entity, SimpleEntity)).rejects.toThrow(
        'No rows were updated'
      );
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      class TestEntity {
        id!: number;
        name!: string;
      }

      MetadataStorage.addEntity(TestEntity, 'test_table');
      MetadataStorage.addColumn(TestEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false });
      MetadataStorage.addColumn(TestEntity, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false });
      MetadataStorage.addPrimaryKey(TestEntity, 'id');
    });

    it('should execute DELETE by primary key', async () => {
      class TestEntity {
        id!: number;
        name!: string;
      }

      await provider.connect();

      const entity = new TestEntity();
      entity.id = 1;
      entity.name = 'Test User';

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 1 }, null), 0);
      });

      await provider.delete(entity, TestEntity);

      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM'),
        expect.arrayContaining([1]),
        expect.any(Function)
      );
    });

    it('should throw error when no rows deleted (entity does not exist)', async () => {
      class TestEntity {
        id!: number;
        name!: string;
      }

      await provider.connect();

      const entity = new TestEntity();
      entity.id = 999;

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, null), 0);
      });

      await expect(provider.delete(entity, TestEntity)).rejects.toThrow(
        'No rows were deleted'
      );
    });
  });

  describe('findById', () => {
    beforeEach(() => {
      class TestEntity {
        id!: number;
        name!: string;
      }

      MetadataStorage.addEntity(TestEntity, 'test_table');
      MetadataStorage.addColumn(TestEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false });
      MetadataStorage.addColumn(TestEntity, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false });
      MetadataStorage.addPrimaryKey(TestEntity, 'id');
    });

    it('should find entity by primary key', async () => {
      class TestEntity {
        id!: number;
        name!: string;
      }

      await provider.connect();

      mockAll.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb(null, [{ id: 1, name: 'Test User' }]), 0);
      });

      const result = await provider.findById(1, TestEntity);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.name).toBe('Test User');
    });

    it('should return null when entity not found', async () => {
      class TestEntity {
        id!: number;
        name!: string;
      }

      await provider.connect();

      mockAll.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb(null, []), 0);
      });

      const result = await provider.findById(999, TestEntity);

      expect(result).toBeNull();
    });

    it('should filter soft-deleted entities when softDelete enabled', async () => {
      class TestEntity {
        id!: number;
        name!: string;
        isDeleted!: boolean;
      }

      MetadataStorage.getInstance().clear();
      MetadataStorage.addEntity(TestEntity, 'test_table');
      MetadataStorage.addColumn(TestEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false });
      MetadataStorage.addColumn(TestEntity, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false });
      MetadataStorage.addColumn(TestEntity, { propertyName: 'isDeleted', columnName: 'isDeleted', type: 'BOOLEAN', nullable: false });
      MetadataStorage.addPrimaryKey(TestEntity, 'id');

      const providerWithSoftDelete = new SQLiteProvider(
        ':memory:',
        mockLogger as unknown as typeof mockLogger,
        undefined,
        { enabled: true, column: 'isDeleted' }
      );
      await providerWithSoftDelete.connect();

      mockAll.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb(null, []), 0);
      });

      await providerWithSoftDelete.findById(1, TestEntity);

      expect(mockAll).toHaveBeenCalledWith(
        expect.stringContaining('isDeleted = 0'),
        expect.any(Array),
        expect.any(Function)
      );

      mockClose.mockImplementation((cb) => setTimeout(() => cb(null), 0));
      await providerWithSoftDelete.disconnect();
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      class TestEntity {
        id!: number;
        name!: string;
      }

      MetadataStorage.addEntity(TestEntity, 'test_table');
      MetadataStorage.addColumn(TestEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false });
      MetadataStorage.addColumn(TestEntity, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false });
      MetadataStorage.addPrimaryKey(TestEntity, 'id');
    });

    it('should return all entities', async () => {
      class TestEntity {
        id!: number;
        name!: string;
      }

      await provider.connect();

      mockAll.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb(null, [
          { id: 1, name: 'User 1' },
          { id: 2, name: 'User 2' }
        ]), 0);
      });

      const results = await provider.findAll(TestEntity);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('User 1');
      expect(results[1].name).toBe('User 2');
    });
  });

  describe('transactions', () => {
    it('should begin transaction and log traceId', async () => {
      await provider.connect();

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, null), 0);
      });

      await provider.beginTransaction();

      expect(mockRun).toHaveBeenCalledWith('BEGIN TRANSACTION', expect.any(Array), expect.any(Function));
      expect(mockLogger.transactionStart).toHaveBeenCalled();
    });

    it('should commit transaction', async () => {
      await provider.connect();

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, null), 0);
      });

      await provider.beginTransaction();
      await provider.commitTransaction();

      expect(mockRun).toHaveBeenCalledWith('COMMIT', expect.any(Array), expect.any(Function));
      expect(mockLogger.transactionEnd).toHaveBeenCalled();
    });

    it('should rollback transaction', async () => {
      await provider.connect();

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, null), 0);
      });

      await provider.beginTransaction();
      await provider.rollbackTransaction();

      expect(mockRun).toHaveBeenCalledWith('ROLLBACK', expect.any(Array), expect.any(Function));
      expect(mockLogger.transactionEnd).toHaveBeenCalled();
    });

    it('should throw error when beginning transaction twice', async () => {
      await provider.connect();

      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, null), 0);
      });

      await provider.beginTransaction();

      await expect(provider.beginTransaction()).rejects.toThrow(
        'Transaction already in progress'
      );
    });

    it('should throw error when committing without active transaction', async () => {
      await provider.connect();

      await expect(provider.commitTransaction()).rejects.toThrow(
        'No transaction in progress'
      );
    });

    it('should throw error when rolling back without active transaction', async () => {
      await provider.connect();

      await expect(provider.rollbackTransaction()).rejects.toThrow(
        'No transaction in progress'
      );
    });
  });

  describe('error mapping', () => {
    it('should map SQLITE_CONSTRAINT to UniqueConstraintError', async () => {
      await provider.connect();

      class TestEntity {
        id!: number;
        email!: string;
      }

      MetadataStorage.getInstance().clear();
      MetadataStorage.addEntity(TestEntity, 'test_table');
      MetadataStorage.addColumn(TestEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false });
      MetadataStorage.addColumn(TestEntity, { propertyName: 'email', columnName: 'email', type: 'TEXT', nullable: false });
      MetadataStorage.addPrimaryKey(TestEntity, 'id');

      const entity = new TestEntity();
      entity.id = 1;
      entity.email = 'duplicate@test.com';

      const error = { code: 'SQLITE_CONSTRAINT', message: 'UNIQUE constraint failed' };
      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, error as Error), 0);
      });

      await expect(provider.insert(entity, TestEntity)).rejects.toThrow(UniqueConstraintError);
    });

    it('should map foreign key error to ForeignKeyConstraintError', async () => {
      await provider.connect();

      const error = { code: 'SQLITE_CONSTRAINT', message: 'FOREIGN KEY constraint failed' };
      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, error as Error), 0);
      });

      await expect(provider.executeNonQuery('DELETE FROM users WHERE id = 1')).rejects.toThrow(
        ForeignKeyConstraintError
      );
    });

    it('should map unknown errors to DatabaseError', async () => {
      await provider.connect();

      const error = { message: 'Unknown database error' };
      mockRun.mockImplementation((sql, params, cb) => {
        setTimeout(() => cb.call({ changes: 0 }, error as Error), 0);
      });

      await expect(provider.executeNonQuery('INVALID SQL')).rejects.toThrow(DatabaseError);
    });
  });

  describe('getDialect', () => {
    it('should return SQLiteDialect instance', () => {
      const dialect = provider.getDialect();

      expect(dialect).toBeDefined();
      expect(dialect.constructor.name).toBe('SQLiteDialect');
    });
  });
});
