import 'reflect-metadata';
import { EntityLoader } from '../../src/loading/EntityLoader';
import type { DatabaseProvider } from '../../src/DatabaseProvider';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';

function providerStub(): jest.Mocked<DatabaseProvider> {
  return {
    providerLabel: 'sqlite',
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    beginTransaction: vi.fn(async () => {}),
    commitTransaction: vi.fn(async () => {}),
    rollbackTransaction: vi.fn(async () => {}),
    inTransactionState: false,
    getDialect: vi.fn(),
    executeQuery: vi.fn(),
    executeNonQuery: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    findById: vi.fn(async () => ({})),
    findAll: vi.fn(async () => [{}]),
    findWhere: vi.fn(async () => []),
    findWhereIn: vi.fn(async () => [])
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
