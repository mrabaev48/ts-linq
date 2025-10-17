import { QueryBuilder } from '../src/query/QueryBuilder';
import type { SqlDialect } from '../src/query/SqlDialect';
import type { QueryOptions, PerformanceOptions, SqlParameter } from '../src/types';
import { EntityCache } from '../src/utils/EntityCache';
import { Queryable } from '../src/query/Queryable';
import { DatabaseProvider } from '../src/DatabaseProvider';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

class FakeDialect implements SqlDialect {
  public calls = 0;
  public buildSelect<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: SqlParameter[] } {
    this.calls++;
    return { query: 'SELECT 1', parameters: [1] };
  }
}

describe('Performance optimizations', () => {
  beforeEach(() => {
    // reset metadata and caches
    MetadataStorage.getInstance().clear();
    QueryBuilder.clearCache();
  });

  test('QueryBuilder caches generated SQL per entity + options', () => {
    class Foo {}
    const dialect = new FakeDialect();
    const qb = new QueryBuilder(dialect);
    const options: QueryOptions = { where: [{ condition: 'id = ?', parameters: [1] }] };

    const first = qb.generateSql(Foo, options);
    const second = qb.generateSql(Foo, options);

    expect(dialect.calls).toBe(1);
    expect(first.query).toBe('SELECT 1');
    expect(second.query).toBe('SELECT 1');
    expect(first.parameters).not.toBe(second.parameters); // cached clone
  });

  test('EntityCache stores and evicts by FIFO', () => {
    class User {}
    const cache = new EntityCache(2);
    cache.set(User, 1, { id: 1 });
    cache.set(User, 2, { id: 2 });
    expect(cache.get(User, 1)).toBeDefined();
    expect(cache.get(User, 2)).toBeDefined();
    cache.set(User, 3, { id: 3 }); // evict first
    expect(cache.get(User, 1)).toBeUndefined();
    expect(cache.get(User, 2)).toBeDefined();
    expect(cache.get(User, 3)).toBeDefined();
  });

  test('Queryable.count uses optional cache with TTL', async () => {
    class Product {
      id!: number;
      name!: string;
    }
    // Register minimal metadata for Product
    MetadataStorage.addEntity(Product, 'Products');
    MetadataStorage.addPrimaryKey(Product, 'id');
    MetadataStorage.addColumn(Product, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(Product, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });

    class ProviderStub extends DatabaseProvider {
      public countCalls = 0;
      public async connect(): Promise<void> {
        /* noop */
      }
      public async disconnect(): Promise<void> {
        /* noop */
      }
      public async createTable(): Promise<void> {
        /* noop */
      }
      public async insert<T>(entity: T): Promise<T> {
        return entity;
      }
      public async update<T>(entity: T): Promise<T> {
        return entity;
      }
      public async delete<T>(): Promise<void> {
        /* noop */
      }
      public async findById<T>(): Promise<T | null> {
        return null;
      }
      public async findAll<T>(): Promise<T[]> {
        return [];
      }
      public async findWhere<T>(): Promise<T[]> {
        return [];
      }
      public async findWhereIn<T>(): Promise<T[]> {
        return [];
      }
      protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
        if (sql.includes('COUNT(*)')) {
          this.countCalls++;
          return [{ count: 42 }] as unknown as T[];
        }
        return [] as unknown as T[];
      }
      protected async doExecuteNonQuery(): Promise<number> {
        return 0;
      }
      public getDialect(): SqlDialect {
        return new FakeDialect();
      }
      public async beginTransaction(): Promise<void> {
        /* noop */
      }
      public async commitTransaction(): Promise<void> {
        /* noop */
      }
      public async rollbackTransaction(): Promise<void> {
        /* noop */
      }
    }

    const provider = new ProviderStub('memory');
    const perf: PerformanceOptions = { enableCountCache: true, countCacheTtlMs: 50 };
    const q = new Queryable<Product>(Product, provider, undefined, undefined, perf);

    const c1 = await q.count();
    const c2 = await q.count();
    expect(c1).toBe(42);
    expect(c2).toBe(42);
    expect(provider.countCalls).toBe(1); // second from cache

    await new Promise((res) => setTimeout(res, 60));
    const c3 = await q.count();
    expect(c3).toBe(42);
    expect(provider.countCalls).toBe(2); // expired, re-queried
  });
});
