import 'reflect-metadata';
import { Queryable } from '../src/query/Queryable';
import { DatabaseProvider } from '../src/providers/DatabaseProvider';
import { SqlDialect } from '../src/query/SqlDialect';
import { CountCache, CountCacheEntry } from '../src/query/CountCache';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

class ProviderStub extends DatabaseProvider {
  public rows: any[] = [];
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
  protected async doExecuteQuery<T>(sql: string, _params?: any[]): Promise<T[]> {
    if (sql.startsWith('SELECT COUNT(')) {
      return [{ count: this.rows.length }] as any;
    }
    return [] as any;
  }
  protected async doExecuteNonQuery(_sql: string, _params?: any[]): Promise<number> {
    return 0;
  }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
}

class DummyDialect implements SqlDialect {
  buildSelect(): { query: string; parameters: any[] } {
    return { query: 'SELECT 1', parameters: [] };
  }
}

class InMemoryCountCache implements CountCache {
  private map = new Map<string, CountCacheEntry>();
  get(key: string): CountCacheEntry | undefined {
    return this.map.get(key);
  }
  set(key: string, entry: CountCacheEntry): void {
    this.map.set(key, entry);
  }
  clear(): void {
    this.map.clear();
  }
}

class E {}

function registerEntity(target: Function, table: string, pk: string): void {
  // Arrange metadata builder state then finalize via getEntity
  MetadataStorage.addEntity(target, table);
  MetadataStorage.addColumn(target, {
    propertyName: pk,
    columnName: pk,
    type: 'INTEGER',
    nullable: false,
    isGenerated: true,
    isVersion: false
  });
  MetadataStorage.addPrimaryKey(target, pk);
  // finalize
  MetadataStorage.getEntity(target);
}

describe('Queryable external CountCache injection (non-breaking opt-in)', () => {
  test('uses external count cache when provided', async () => {
    const provider = new ProviderStub('conn');
    (provider as any)._dialect = new DummyDialect();
    const cache = new InMemoryCountCache();
    // finalize metadata and construct queryable
    registerEntity(E, 'e', 'id');
    const q = new Queryable<any>(E as any, provider as any);
    (q as any)._externalCountCache = cache;
    // enable count cache behavior
    (q as any)._performance = { enableCountCache: true };

    // first call populates
    provider.rows = [{}, {}, {}];
    const c1 = await q.count();
    expect(c1).toBe(3);

    // change underlying rows to ensure we hit cache, not DB
    provider.rows = [{}, {}];
    const c2 = await q.count();
    expect(c2).toBe(3);
  });
});
