import 'reflect-metadata';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../../src/DatabaseProvider';
import { DbContext } from '../../src/context/DbContext';

class Ctx extends DbContext {}

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
    insert: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    upsert: vi.fn(async () => {}),
    findById: vi.fn(async () => null),
    findAll: vi.fn(async () => []),
    findWhereIn: vi.fn(async () => []),
    findWhere: vi.fn(async () => [])
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
    provider.findById = vi.fn(async () => ({ id: 1 }));
    const ctx = new Ctx({ provider });
    const set = ctx.set(E);
    await set.upsert({ id: 1 } as any); // should update
    await set.upsert({ id: undefined as unknown as number } as any); // should add
    expect(provider.findById).toHaveBeenCalledWith(1, E);
  });

  test('upsertMany mixes add/update based on existing ids', async () => {
    const provider = providerStub();
    provider.findWhereIn = vi.fn(async () => [{ id: 2 }]);
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
