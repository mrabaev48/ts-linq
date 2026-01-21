import { Queryable } from '../src/Queryable';
import { MetadataStorage } from '@ts-linq/metadata';
import { DatabaseProvider } from '@ts-linq/core';
import type { SqlDialect, SqlParameter } from '@ts-linq/types';

class User {
  id!: number;
  name!: string;
}

class TestDialect implements SqlDialect {
  public buildSelect<T>(
    entityClass: new () => T,
    options: unknown
  ): { query: string; parameters: readonly SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass) || { tableName: entityClass.name };
    const opts = options as { limit?: number; offset?: number } | undefined;
    const limit = typeof opts?.limit === 'number' ? opts.limit : undefined;
    const offset = typeof opts?.offset === 'number' ? opts.offset : 0;
    const marker = limit !== undefined ? ` /*LIMIT=${limit},OFFSET=${offset}*/` : '';
    return { query: `SELECT * FROM ${meta.tableName}${marker}`, parameters: [] };
  }
  public quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}

class TestProvider extends DatabaseProvider {
  private rows: Record<string, unknown>[] = [];
  private countValue: number = 0;
  private readonly dialect = new TestDialect();
  public setRows(rows: Record<string, unknown>[]): void {
    this.rows = rows;
  }
  public setCount(n: number): void {
    this.countValue = n;
  }
  // Abstracts
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect {
    return this.dialect;
  }
  public async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete(): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return [] as unknown as T[];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [] as unknown as T[];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [] as unknown as T[];
  }
  protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
    if (/COUNT\(\*\)\s+as\s+count/i.test(sql)) {
      return [{ count: this.countValue }] as unknown as T[];
    }
    const m = /\/\*LIMIT=(\d+),OFFSET=(\d+)\*\//.exec(sql);
    if (m) {
      const limit = parseInt(m[1]!, 10);
      const offset = parseInt(m[2]!, 10);
      return this.rows.slice(offset, offset + limit) as unknown as T[];
    }
    return this.rows as unknown as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 1;
  }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
  public constructor() {
    // providerName label is used for cache keys/metrics
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    (this as unknown as { providerName: string }).providerName = 'test';
  }
}

function registerUserMetadata(): void {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(User, 'users');
  MetadataStorage.addColumn(User, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    primaryKey: true
  });
  MetadataStorage.addPrimaryKey(User, 'id');
  MetadataStorage.addColumn(User, {
    propertyName: 'name',
    columnName: 'name',
    type: 'TEXT'
  });
}

describe('Queryable (tests-new)', () => {
  beforeEach(() => {
    registerUserMetadata();
  });

  test('toArray() возвращает сущности и маппит поля по метаданным', async () => {
    const provider = new TestProvider();
    provider.setRows([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]);
    const q = new Queryable(User, provider);
    const items = await q.toArray();
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(expect.objectContaining({ id: 1, name: 'Alice' }));
  });

  test('where() и orderBy()/skip()/take() не ломают исполнение', async () => {
    const provider = new TestProvider();
    provider.setRows([{ id: 3, name: 'Carol' }]);
    const q = new Queryable(User, provider)
      .where((u) => u.id > 1)
      .orderBy((u) => u.id)
      .skip(0)
      .take(10);
    const res = await q.toArray();
    expect(res[0].id).toBe(3);
  });

  test('count() использует кэш при enableCountCache', async () => {
    const provider = new TestProvider();
    provider.setCount(42);
    const q = new Queryable(
      User,
      provider,
      undefined,
      undefined,
      { enableCountCache: true, countCacheTtlMs: 10_000 },
      undefined
    ).where((u) => u.id > 0);
    const n1 = await q.count();
    expect(n1).toBe(42);
    // Изменим провайдер, но второй вызов должен прийти из кэша
    provider.setCount(7);
    const n2 = await q.count();
    expect(n2).toBe(42);
  });

  test('first()/firstOrDefault()/any() работают поверх провайдера', async () => {
    const provider = new TestProvider();
    provider.setRows([{ id: 10, name: 'D' }]);
    const q = new Queryable(User, provider).orderBy((u) => u.id);
    const first = await q.first();
    expect(first.id).toBe(10);
    const any = await q.any();
    expect(any).toBe(true);
    // Пустой результат для firstOrDefault()
    provider.setRows([]);
    const firstOrDefault = await new Queryable(User, provider).where((u) => u.id === -1).firstOrDefault();
    expect(firstOrDefault).toBeNull();
  });
});


