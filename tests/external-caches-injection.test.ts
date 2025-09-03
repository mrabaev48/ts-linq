import 'reflect-metadata';
import { Queryable } from '../src/query/Queryable';
import { DatabaseProvider } from '../src/providers/DatabaseProvider';
import { SqlDialect } from '../src/query/SqlDialect';
import { SqlCache, SqlCacheEntry } from '../src/query/SqlCache';
import { CountCache, CountCacheEntry } from '../src/query/CountCache';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

class ProviderStub extends DatabaseProvider {
  public rows: any[] = [];
  public calls = 0;
  public dialect: SqlDialect = new DummyDialect();
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public async insert<T>(entity: T): Promise<T> { return entity; }
  public async update<T>(entity: T): Promise<T> { return entity; }
  public async delete<T>(): Promise<void> {}
  public async findById<T>(): Promise<T | null> { return null; }
  public async findAll<T>(): Promise<T[]> { return [] as any; }
  public async findWhere<T>(): Promise<T[]> { return [] as any; }
  public async findWhereIn<T>(): Promise<T[]> { return [] as any; }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
  public getDialect(): SqlDialect { return this.dialect; }
  protected async doExecuteQuery<T>(sql: string, _params?: any[]): Promise<T[]> {
    this.calls++;
    if (sql.startsWith('SELECT COUNT(')) {
      return [{ count: this.rows.length }] as any;
    }
    return [] as any;
  }
  protected async doExecuteNonQuery(_sql: string, _params?: any[]): Promise<number> { return 0; }
}

class DummyDialect implements SqlDialect {
  public builds = 0;
  buildSelect<T>(_entityClass: new () => T, _options: any): { query: string; parameters: any[] } {
    this.builds++;
    return { query: 'SELECT 1', parameters: [] };
  }
}

class ExtSqlCache implements SqlCache {
  private map = new Map<string, SqlCacheEntry>();
  get(key: string): SqlCacheEntry | undefined { return this.map.get(key); }
  set(key: string, value: SqlCacheEntry): void { this.map.set(key, value); }
  clear(): void { this.map.clear(); }
  size(): number { return this.map.size; }
}

class ExtCountCache implements CountCache {
  private map = new Map<string, CountCacheEntry>();
  get(key: string): CountCacheEntry | undefined { return this.map.get(key); }
  set(key: string, entry: CountCacheEntry): void { this.map.set(key, entry); }
  clear(): void { this.map.clear(); }
}

class E {}

function registerEntity(target: Function, table: string, pk: string): void {
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
  MetadataStorage.getEntity(target);
}

describe('PerformanceOptions external caches injection', () => {
  beforeEach(() => {
    registerEntity(E, 'e', 'id');
  });

  test('sqlCache reduces dialect builds via Queryable path', async () => {
    const provider = new ProviderStub('conn');
    provider.dialect = new DummyDialect();
    const sqlCache = new ExtSqlCache();
    const q = new Queryable<any>(E as any, provider as any, undefined, undefined, { sqlCache });
    await q.toArray();
    await q.toArray();
    expect((provider as any).dialect.builds).toBe(1);
    expect(sqlCache.size()).toBe(1);
  });

  test('countCache returns cached value on second call', async () => {
    const provider = new ProviderStub('conn');
    (provider as any)._dialect = new DummyDialect();
    const countCache = new ExtCountCache();
    const q = new Queryable<any>(E as any, provider as any, undefined, undefined, {
      countCache,
      enableCountCache: true
    });
    provider.rows = [{}, {}, {}];
    const a = await q.count();
    expect(a).toBe(3);
    provider.rows = [{}];
    const b = await q.count();
    expect(b).toBe(3);
  });
});


