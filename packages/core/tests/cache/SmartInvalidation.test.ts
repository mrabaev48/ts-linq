import 'reflect-metadata';
import { DbContext } from '../../src/context/DbContext';
import { DatabaseProvider } from '../../src/DatabaseProvider';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import { CachePolicy } from '../../src/decorators/CachePolicy';
import type { EntityCacheLike } from '../../src/utils/EntityCache';

@CachePolicy({ invalidateOn: ['Order'] })
class Product {
  id!: number;
}
class Order {
  id!: number;
}

class MemoryL2 implements EntityCacheLike {
  public clearCalls = 0;
  private m = new Map<string, unknown>();
  private k(c: Function, id: unknown) {
    return `${c.name}|${id}`;
  }
  get<T>(c: Function, id: unknown): T | undefined {
    return this.m.get(this.k(c, id)) as T | undefined;
  }
  set<T>(c: Function, id: unknown, e: T): void {
    this.m.set(this.k(c, id), e);
  }
  remove(c: Function, id: unknown): void {
    this.m.delete(this.k(c, id));
  }
  clear(): void {
    this.clearCalls++;
    this.m.clear();
  }
  size(): number {
    return this.m.size;
  }
}

class ProviderStub extends DatabaseProvider {
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public async insert<T>(entity: T): Promise<T> {
    return entity;
  }
  public async update<T>(entity: T): Promise<T> {
    return entity;
  }
  public async delete<T>(): Promise<void> {}
  public async findById<T>(): Promise<T | null> {
    return null;
  }
  public async findAll<T>(): Promise<T[]> {
    return [] as unknown as T[];
  }
  public async findWhere<T>(): Promise<T[]> {
    return [] as unknown as T[];
  }
  public async findWhereIn<T>(): Promise<T[]> {
    return [] as unknown as T[];
  }
  protected async doExecuteQuery<T>(): Promise<T[]> {
    return [] as unknown as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
}

class Ctx extends DbContext {
  constructor(cache: EntityCacheLike) {
    const provider = new ProviderStub('x');
    (provider as unknown as { getDialect: () => any }).getDialect = () => ({
      buildSelect: () => ({ query: 'SELECT 1', parameters: [] })
    });
    super({ provider, performance: { enableEntityCache: true, entityCache: cache } } as any);
  }
}

describe('Smart cache invalidation', () => {
  test('clears L2 entirely when dependent entity changed', async () => {
    MetadataStorage.addEntity(Product, 'products');
    MetadataStorage.addPrimaryKey(Product, 'id');
    MetadataStorage.addEntity(Order, 'orders');
    MetadataStorage.addPrimaryKey(Order, 'id');
    const l2 = new MemoryL2();
    const ctx = new Ctx(l2) as unknown as { orders: any };
    // Simulate change and save
    ctx.orders.add({ id: 1 });
    await (ctx as unknown as { saveChanges: () => Promise<number> }).saveChanges();
    // Because Product depends on Order, full clear is expected
    expect(l2.clearCalls).toBeGreaterThanOrEqual(1);
  });
});
