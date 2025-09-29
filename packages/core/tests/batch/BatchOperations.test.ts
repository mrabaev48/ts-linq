import type { BatchResult } from '../../src/batch/BatchOperations';
import { BatchOperations } from '../../src/batch/BatchOperations';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../../src/DatabaseProvider';
import type { ColumnMetadata, EntityMetadata } from '../../src/types';

// Test entities
class User {
  id!: number;
  name!: string;
  email!: string;
  age!: number;
}

class Product {
  id!: number;
  name!: string;
  price!: number;
}

describe('BatchOperations', () => {
  let batchOps: BatchOperations;
  let mockProvider: jest.Mocked<DatabaseProvider>;
  let mockMetadata: EntityMetadata;

  beforeEach(() => {
    // Clear and setup metadata
    MetadataStorage.getInstance().clear();

    // Set up User entity metadata properly
    MetadataStorage.addEntity(User, 'users');
    const userIdCol: ColumnMetadata = {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    };
    const userNameCol: ColumnMetadata = {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    };
    const userEmailCol: ColumnMetadata = {
      propertyName: 'email',
      columnName: 'email',
      type: 'TEXT',
      nullable: false
    };
    const userAgeCol: ColumnMetadata = {
      propertyName: 'age',
      columnName: 'age',
      type: 'INTEGER',
      nullable: false
    };
    MetadataStorage.addColumn(User, userIdCol);
    MetadataStorage.addColumn(User, userNameCol);
    MetadataStorage.addColumn(User, userEmailCol);
    MetadataStorage.addColumn(User, userAgeCol);
    MetadataStorage.addPrimaryKey(User, 'id');

    // Set up Product entity metadata
    MetadataStorage.addEntity(Product, 'products');
    const productIdCol: ColumnMetadata = {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    };
    const productNameCol: ColumnMetadata = {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    };
    const productPriceCol: ColumnMetadata = {
      propertyName: 'price',
      columnName: 'price',
      type: 'REAL',
      nullable: false
    };
    MetadataStorage.addColumn(Product, productIdCol);
    MetadataStorage.addColumn(Product, productNameCol);
    MetadataStorage.addColumn(Product, productPriceCol);
    MetadataStorage.addPrimaryKey(Product, 'id');

    // Mock provider
    mockProvider = {
      insertMany: jest.fn(),
      updateMany: jest.fn(),
      upsertMany: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      executeNonQuery: jest.fn(),
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      getDialect: jest.fn(),
      inTransactionState: false
    } as unknown as jest.Mocked<DatabaseProvider>;

    batchOps = new BatchOperations(mockProvider);
  });

  afterEach(() => {
    MetadataStorage.getInstance().clear();
  });

  describe('bulkInsert', () => {
    test('should handle empty array', async () => {
      const result = await batchOps.bulkInsert([], User);

      expect(result.entities).toEqual([]);
      expect(result.failedCount).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('should use provider insertMany when available', async () => {
      const users = [
        { id: 1, name: 'John', email: 'john@test.com', age: 30 },
        { id: 2, name: 'Jane', email: 'jane@test.com', age: 25 }
      ];

      mockProvider.insertMany.mockResolvedValueOnce(users as unknown as object[]);

      const result = await batchOps.bulkInsert(users, User);

      expect(mockProvider.insertMany).toHaveBeenCalledWith(users, User);
      expect(result.entities).toEqual(users);
      expect(result.failedCount).toBe(0);
    });

    test('should fallback to bulk SQL when provider method not available', async () => {
      const users = [
        { id: 1, name: 'John', email: 'john@test.com', age: 30 },
        { id: 2, name: 'Jane', email: 'jane@test.com', age: 25 }
      ];

      // Remove insertMany to test fallback
      delete (mockProvider as unknown as Record<string, unknown>).insertMany;
      mockProvider.executeNonQuery.mockResolvedValueOnce(2);

      const result = await batchOps.bulkInsert(users, User);

      expect(mockProvider.executeNonQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining(['John', 'john@test.com', 30, 'Jane', 'jane@test.com', 25])
      );
      expect(result.entities).toEqual(users);
    });

    test('should use transactions when enabled', async () => {
      const users = [{ id: 1, name: 'John', email: 'john@test.com', age: 30 }];
      mockProvider.insertMany.mockResolvedValueOnce(users as unknown as object[]);

      await batchOps.bulkInsert(users, User, { useTransactions: true });

      expect(mockProvider.beginTransaction).toHaveBeenCalled();
      expect(mockProvider.commitTransaction).toHaveBeenCalled();
    });

    test('should handle chunking with custom batch size', async () => {
      const users = Array.from({ length: 4 }, (_, i) => ({
        id: i + 1,
        name: `User${i + 1}`,
        email: `user${i + 1}@test.com`,
        age: 20 + i
      }));

      mockProvider.insertMany
        .mockResolvedValueOnce(users.slice(0, 2) as unknown as object[])
        .mockResolvedValueOnce(users.slice(2, 4) as unknown as object[]);

      const result = await batchOps.bulkInsert(users, User, { batchSize: 2 });

      expect(mockProvider.insertMany).toHaveBeenCalledTimes(2);
      expect(result.entities).toEqual(users);
    });

    test('should handle progress callbacks', async () => {
      const users = Array.from({ length: 4 }, (_, i) => ({
        id: i + 1,
        name: `User${i + 1}`,
        email: `user${i + 1}@test.com`,
        age: 20 + i
      }));

      mockProvider.insertMany
        .mockResolvedValueOnce(users.slice(0, 2) as unknown as object[])
        .mockResolvedValueOnce(users.slice(2, 4) as unknown as object[]);

      const progressCallback = jest.fn();

      await batchOps.bulkInsert(users, User, {
        batchSize: 2,
        onProgress: progressCallback
      });

      expect(progressCallback).toHaveBeenCalledWith(2, 4);
      expect(progressCallback).toHaveBeenCalledWith(4, 4);
    });

    test('should handle errors with continueOnError', async () => {
      const users = [
        { id: 1, name: 'John', email: 'john@test.com', age: 30 },
        { id: 2, name: 'Jane', email: 'jane@test.com', age: 25 },
        { id: 3, name: 'Bob', email: 'bob@test.com', age: 35 }
      ];

      // Remove insertMany to force fallback behavior
      delete (mockProvider as unknown as Record<string, unknown>).insertMany;

      // Mock executeNonQuery to succeed for first and third, fail for second
      mockProvider.executeNonQuery
        .mockResolvedValueOnce(1) // First user success
        .mockRejectedValueOnce(new Error('Duplicate key')) // Second user fails
        .mockResolvedValueOnce(1); // Third user success

      const result = (await batchOps.bulkInsert(users, User, {
        batchSize: 1,
        continueOnError: true,
        returnDetailedResults: true
      })) as unknown as BatchResult<(typeof users)[0]>;

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error.message).toBe('Duplicate key');
      expect(result.totalProcessed).toBe(3);
    });

    test('should throw error when continueOnError is false', async () => {
      const users = [{ id: 1, name: 'John', email: 'john@test.com', age: 30 }];

      // Remove insertMany to force fallback
      delete (mockProvider as unknown as Record<string, unknown>).insertMany;
      mockProvider.executeNonQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(batchOps.bulkInsert(users, User, { continueOnError: false })).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('bulkUpdate', () => {
    test('should use provider updateMany when available', async () => {
      const users = [
        { id: 1, name: 'John Updated', email: 'john@test.com', age: 31 },
        { id: 2, name: 'Jane Updated', email: 'jane@test.com', age: 26 }
      ];

      mockProvider.updateMany.mockResolvedValueOnce(users as unknown as object[]);

      const result = await batchOps.bulkUpdate(users, User);

      expect(mockProvider.updateMany).toHaveBeenCalledWith(users, User);
      expect(result.entities).toEqual(users);
    });

    test('should fallback to individual updates', async () => {
      const users = [{ id: 1, name: 'John Updated', email: 'john@test.com', age: 31 }];

      // Remove updateMany to test fallback
      delete (mockProvider as unknown as Record<string, unknown>).updateMany;
      mockProvider.update.mockResolvedValueOnce(users[0] as unknown as object);

      const result = await batchOps.bulkUpdate(users, User);

      expect(mockProvider.update).toHaveBeenCalledWith(users[0], User);
      expect(result.entities).toEqual(users);
    });
  });

  describe('bulkDelete', () => {
    test('should generate DELETE IN query', async () => {
      const users = [
        { id: 1, name: 'John', email: 'john@test.com', age: 30 },
        { id: 2, name: 'Jane', email: 'jane@test.com', age: 25 }
      ];

      mockProvider.executeNonQuery.mockResolvedValueOnce(2);

      const result = await batchOps.bulkDelete(users, User);

      expect(mockProvider.executeNonQuery).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM users\s+WHERE id IN \(\?, \?\)/),
        [1, 2]
      );
      expect(result.deletedCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    test('should handle empty primary keys', async () => {
      const users = [
        { id: null as unknown as number, name: 'John', email: 'john@test.com', age: 30 },
        { id: undefined as unknown as number, name: 'Jane', email: 'jane@test.com', age: 25 }
      ];

      const result = await batchOps.bulkDelete(users, User);

      expect(mockProvider.executeNonQuery).not.toHaveBeenCalled();
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('bulkUpsert', () => {
    test('should use provider upsertMany when available', async () => {
      const users = [
        { id: 1, name: 'John', email: 'john@test.com', age: 30 },
        { id: 2, name: 'Jane', email: 'jane@test.com', age: 25 }
      ];

      mockProvider.upsertMany.mockResolvedValueOnce(users as unknown as object[]);

      const result = await batchOps.bulkUpsert(users, User);

      expect(mockProvider.upsertMany).toHaveBeenCalledWith(users, User);
      expect(result.entities).toEqual(users);
    });

    test('should fallback to individual upserts', async () => {
      const users = [{ id: 1, name: 'John', email: 'john@test.com', age: 30 }];

      // Remove upsertMany to test fallback
      delete (mockProvider as unknown as Record<string, unknown>).upsertMany;
      mockProvider.upsert.mockResolvedValueOnce(users[0] as unknown as object);

      const result = await batchOps.bulkUpsert(users, User);

      expect(mockProvider.upsert).toHaveBeenCalledWith(users[0], User);
      expect(result.entities).toEqual(users);
    });
  });

  describe('Configuration', () => {
    test('should set and get default batch size', () => {
      expect(batchOps.getDefaultBatchSize()).toBe(1000);

      batchOps.setDefaultBatchSize(500);
      expect(batchOps.getDefaultBatchSize()).toBe(500);
    });

    test('should throw error for invalid batch size', () => {
      expect(() => batchOps.setDefaultBatchSize(0)).toThrow('Batch size must be greater than 0');
      expect(() => batchOps.setDefaultBatchSize(-1)).toThrow('Batch size must be greater than 0');
    });
  });

  describe('Error Handling', () => {
    test('should rollback transaction on error', async () => {
      const users = [{ id: 1, name: 'John', email: 'john@test.com', age: 30 }];
      mockProvider.insertMany.mockResolvedValueOnce(users as unknown as object[]);
      delete (mockProvider as unknown as Record<string, unknown>).insertMany;
      mockProvider.executeNonQuery.mockRejectedValueOnce(new Error('Database error'));
      Object.defineProperty(mockProvider, 'inTransactionState', { value: true, writable: true });

      await expect(batchOps.bulkInsert(users, User, { useTransactions: true })).rejects.toThrow(
        'Database error'
      );

      expect(mockProvider.rollbackTransaction).toHaveBeenCalled();
    });

    test('should throw error for missing metadata', async () => {
      class UnknownEntity {
        id!: number;
      }
      const entities = [{ id: 1 }];
      await expect(batchOps.bulkInsert(entities, UnknownEntity)).rejects.toThrow(
        'No metadata found for entity UnknownEntity'
      );
    });

    test('should throw error for missing primary key in delete', async () => {
      class EntityWithoutPK {
        name!: string;
      }
      MetadataStorage.getInstance().clear();
      MetadataStorage.addEntity(EntityWithoutPK, 'test_table');
      const nameCol: ColumnMetadata = {
        propertyName: 'name',
        columnName: 'name',
        type: 'TEXT',
        nullable: false
      };
      MetadataStorage.addColumn(EntityWithoutPK, nameCol);

      const entities = [{ name: 'John' }];
      await expect(batchOps.bulkDelete(entities, EntityWithoutPK)).rejects.toThrow(
        'No primary key found for entity'
      );
    });
  });
});
