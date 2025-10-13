import { EntityLoader } from '@ts-linq/orm/src/loading/EntityLoader';
import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/core';

function providerStub(): jest.Mocked<DatabaseProvider> {
  return {
    providerLabel: 'sqlite',
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    beginTransaction: jest.fn(async () => {}),
    commitTransaction: jest.fn(async () => {}),
    rollbackTransaction: jest.fn(async () => {}),
    inTransactionState: false,
    getDialect: jest.fn(),
    executeQuery: jest.fn(),
    executeNonQuery: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    findById: jest.fn(async () => ({})),
    findAll: jest.fn(async () => [{}]),
    findWhere: jest.fn(async () => []),
    findWhereIn: jest.fn(async () => [])
  } as unknown as jest.Mocked<DatabaseProvider>;
}

describe('EntityLoader invalid includes', () => {
  class A {
    id!: number;
  }
  class B {
    id!: number;
    aId?: number;
    a?: A;
  }
  beforeEach(() => {
    (MetadataStorage as unknown as { getInstance: () => MetadataStorage }).getInstance().clear();
    MetadataStorage.addEntity(A, 'A');
    MetadataStorage.addPrimaryKey(A, 'id');
    MetadataStorage.addColumn(A, { propertyName: 'id', columnName: 'id', type: 'INTEGER' } as any);
    MetadataStorage.addEntity(B, 'B');
    MetadataStorage.addPrimaryKey(B, 'id');
    MetadataStorage.addColumn(B, { propertyName: 'id', columnName: 'id', type: 'INTEGER' } as any);
    MetadataStorage.addRelationship(B, {
      propertyName: 'a',
      type: 'many-to-one',
      targetEntity: A,
      foreignKey: 'aId'
    } as any);
  });

  test('loadEntity throws for invalid include name', async () => {
    const loader = new EntityLoader(providerStub());
    await expect(
      loader.loadEntity(B, 1, { strategy: 'eager', includes: ['unknown'] as any })
    ).rejects.toThrow("Invalid include 'unknown'");
  });
});
