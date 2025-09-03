import 'reflect-metadata';
import { Queryable } from '../src/query/Queryable';
import { DatabaseProvider } from '../src/providers/DatabaseProvider';
import { SqlDialect } from '../src/query/SqlDialect';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { EntityCacheLike } from '../src/utils/EntityCache';

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
    return [] as any;
  }
  public async findWhere<T>(): Promise<T[]> {
    return [] as any;
  }
  public async findWhereIn<T>(): Promise<T[]> {
    return [] as any;
  }
  protected async doExecuteQuery<T>(_sql: string, _params?: any[]): Promise<T[]> {
    return [{ id: 1 }] as any;
  }
  protected async doExecuteNonQuery(_sql: string, _params?: any[]): Promise<number> {
    return 0;
  }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
}

class DummyDialect implements SqlDialect {
  buildSelect<T>(_entityClass: new () => T, _options: any): { query: string; parameters: any[] } {
    return { query: 'SELECT 1', parameters: [] };
  }
}

class CapturingEntityCache implements EntityCacheLike {
  public gets: Array<{ key: string; id: any }> = [];
  public sets: Array<{ key: string; id: any }> = [];
  private store = new Map<string, any>();
  private k(entityClass: Function, id: any) {
    return `${entityClass.name}|${id}`;
  }
  get<T>(entityClass: Function, id: any): T | undefined {
    this.gets.push({ key: entityClass.name, id });
    return this.store.get(this.k(entityClass, id));
  }
  set<T>(entityClass: Function, id: any, entity: T): void {
    this.sets.push({ key: entityClass.name, id });
    this.store.set(this.k(entityClass, id), entity);
  }
  remove(entityClass: Function, id: any): void {
    this.store.delete(this.k(entityClass, id));
  }
  clear(): void {
    this.store.clear();
  }
}

class E {}

describe('L2 cache injection (EntityCacheLike)', () => {
  test('Queryable uses injected L2 cache when enabled', async () => {
    // register minimal metadata
    MetadataStorage.addEntity(E, 'e');
    MetadataStorage.addColumn(E, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true,
      isVersion: false
    });
    MetadataStorage.addPrimaryKey(E, 'id');
    MetadataStorage.getEntity(E);

    const provider = new ProviderStub('conn');
    // Optional: override dialect to a dummy one if needed
    (provider as any).getDialect = () => new DummyDialect();

    const cache = new CapturingEntityCache();
    const q = new Queryable<any>(E as any, provider as any, undefined, cache, {
      enableEntityCache: true
    });
    await q.toArray();
    expect(cache.sets.length).toBeGreaterThanOrEqual(1);
    expect(cache.gets.length).toBeGreaterThanOrEqual(1);
  });
});
