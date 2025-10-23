import 'reflect-metadata';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../../src/DatabaseProvider';
import { DbContext } from '../../src/context/DbContext';

class Ctx extends DbContext {}

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
    insert: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    delete: jest.fn(async () => {}),
    upsert: jest.fn(async () => {}),
    findById: jest.fn(async () => null),
    findAll: jest.fn(async () => []),
    findWhereIn: jest.fn(async () => []),
    findWhere: jest.fn(async () => [])
  } as unknown as jest.Mocked<DatabaseProvider>;
}

describe('DbSet extra', () => {
  class E {
    id!: number;
    code?: string;
  }
  beforeEach(() => {
    (MetadataStorage as unknown as { getInstance: () => MetadataStorage }).getInstance().clear();
    MetadataStorage.addEntity(E, 'E');
    MetadataStorage.addPrimaryKey(E, 'id');
    MetadataStorage.addColumn(E, { propertyName: 'id', columnName: 'id', type: 'INTEGER' } as any);
    MetadataStorage.addColumn(E, {
      propertyName: 'code',
      columnName: 'code_col',
      type: 'TEXT'
    } as any);
  });

  test('findByIds delegates to provider.findWhereIn with PK column', async () => {
    const provider = providerStub();
    const ctx = new Ctx({ provider });
    await ctx.set(E).findByIds([1, 2]);
    expect(provider.findWhereIn).toHaveBeenCalledWith(E, 'id', [1, 2]);
  });

  test('findWhereIn maps property to columnName via metadata', async () => {
    const provider = providerStub();
    const ctx = new Ctx({ provider });
    await ctx.set(E).findWhereIn('code', ['X']);
    expect(provider.findWhereIn).toHaveBeenCalledWith(E, 'code_col', ['X']);
  });

  test('upsert adds when no PK value, updates/adds based on existence', async () => {
    const provider = providerStub();
    provider.findById = jest.fn(async () => ({ id: 1 }));
    const ctx = new Ctx({ provider });
    const set = ctx.set(E);
    await set.upsert({ id: 1 } as any); // should update
    await set.upsert({ id: undefined as unknown as number } as any); // should add
    expect(provider.findById).toHaveBeenCalledWith(1, E);
  });

  test('upsertMany mixes add/update based on existing ids', async () => {
    const provider = providerStub();
    provider.findWhereIn = jest.fn(async () => [{ id: 2 }]);
    const ctx = new Ctx({ provider });
    const set = ctx.set(E);
    const res = await set.upsertMany([
      { id: 1 } as any,
      { id: 2 } as any,
      { id: undefined as any } as any
    ]);
    expect(res).toHaveLength(3);
    expect(provider.findWhereIn).toHaveBeenCalledWith(E, 'id', [1, 2]);
  });
});
