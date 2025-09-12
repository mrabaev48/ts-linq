import 'reflect-metadata';
import { Queryable } from '../src/query/Queryable';
import { DatabaseProvider } from '../src/providers/DatabaseProvider';
import type { SqlDialect } from '../src/query/SqlDialect';
import type { QueryOptions, SqlParameter } from '../src/types';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { EntityCacheLike } from '../src/utils/EntityCache';

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
  protected async doExecuteQuery<T>(_sql: string, _params?: readonly SqlParameter[]): Promise<T[]> {
    return [{ id: 1 } as unknown as T];
  }
  protected async doExecuteNonQuery(
    _sql: string,
    _params?: readonly SqlParameter[]
  ): Promise<number> {
    return 0;
  }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
}

class DummyDialect implements SqlDialect {
  buildSelect<T>(
    _entityClass: new () => T,
    _options: QueryOptions
  ): {
    query: string;
    parameters: SqlParameter[];
  } {
    return { query: 'SELECT 1', parameters: [] };
  }
}

class CapturingEntityCache implements EntityCacheLike {
  public gets: Array<{ key: string; id: unknown }> = [];
  public sets: Array<{ key: string; id: unknown }> = [];
  private store = new Map<string, unknown>();
  private k(entityClass: Function, id: unknown) {
    return `${entityClass.name}|${id}`;
  }
  get<T>(entityClass: Function, id: unknown): T | undefined {
    this.gets.push({ key: entityClass.name, id });
    return this.store.get(this.k(entityClass, id)) as T | undefined;
  }
  set<T>(entityClass: Function, id: unknown, entity: T): void {
    this.sets.push({ key: entityClass.name, id });
    this.store.set(this.k(entityClass, id), entity);
  }
  remove(entityClass: Function, id: unknown): void {
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
    // Override dialect to a dummy one via method override pattern
    (provider as unknown as { getDialect: () => SqlDialect }).getDialect = () => new DummyDialect();

    const cache = new CapturingEntityCache();
    const q = new Queryable<E>(E as unknown as new () => E, provider, undefined, cache, {
      enableEntityCache: true
    });
    await q.toArray();
    expect(cache.sets.length).toBeGreaterThanOrEqual(1);
    expect(cache.gets.length).toBeGreaterThanOrEqual(1);
  });
});
