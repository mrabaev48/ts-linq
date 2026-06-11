import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { QueryContext } from '@ts-linq/query/internal';
import type { SqlDialect, SqlParameter } from '@ts-linq/types';

import { Queryable } from '../src/Queryable';
import { TypedQueryable } from '../src/TypedQueryable';

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
    const opts = options as { limit?: number; offset?: number; select?: string[] } | undefined;
    const limit = typeof opts?.limit === 'number' ? opts.limit : undefined;
    const offset = typeof opts?.offset === 'number' ? opts.offset : 0;
    const marker = limit !== undefined ? ` /*LIMIT=${limit},OFFSET=${offset}*/` : '';
    const selectClause = opts?.select?.join(', ') ?? '*';
    return { query: `SELECT ${selectClause} FROM ${meta.tableName}${marker}`, parameters: [] };
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
  public override async connect(): Promise<void> {}
  public override async disconnect(): Promise<void> {}
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
    return [];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
    if (/COUNT\(\*\)\s+as\s+count/i.test(sql)) {
      return [{ count: this.countValue }] as unknown as T[];
    }
    const m = /\/\*LIMIT=(\d+),OFFSET=(\d+)\*\//.exec(sql);
    if (m) {
      const limit = parseInt(m[1], 10);
      const offset = parseInt(m[2], 10);
      return this.rows.slice(offset, offset + limit) as unknown as T[];
    }
    return this.rows as unknown as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 1;
  }
  public override async beginTransaction(): Promise<void> {}
  public override async commitTransaction(): Promise<void> {}
  public override async rollbackTransaction(): Promise<void> {}
  protected override async doConnect(): Promise<void> {}
  protected override async doDisconnect(): Promise<void> {}
  protected override async doBeginTransaction(): Promise<void> {}
  protected override async doCommitTransaction(): Promise<void> {}
  protected override async doRollbackTransaction(): Promise<void> {}
  public constructor() {
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

describe('TypedQueryable (tests-new)', () => {
  beforeEach(() => {
    registerUserMetadata();
  });

  test('basic operations: where + orderBy + toArray', async () => {
    const provider = new TestProvider();
    provider.setRows([
      { id: 2, name: 'B' },
      { id: 1, name: 'A' }
    ]);
    const typed = TypedQueryable.from(new Queryable(User, QueryContext.fromProvider(provider)))
      .whereCompiled({
        ast: {
          type: 'binary',
          left: { type: 'property', path: ['id'] },
          operator: '>=',
          right: { type: 'literal', value: 1 }
        },
        parameters: []
      })
      .orderBy('id', 'DESC')
      .thenBy('name');
    const items = await typed.toArray();
    expect(items.length).toBe(2);
  });

  test('count()/any()/first() are proxied correctly', async () => {
    const provider = new TestProvider();
    provider.setRows([{ id: 5, name: 'Z' }]);
    provider.setCount(1);
    const typed = TypedQueryable.from(new Queryable(User, QueryContext.fromProvider(provider)));
    expect(await typed.count()).toBe(1);
    expect(await typed.any()).toBe(true);
    expect((await typed.first()).id).toBe(5);
  });

  test('paginate() returns expected shape', async () => {
    const provider = new TestProvider();
    provider.setRows(Array.from({ length: 3 }, (_, i) => ({ id: i + 1, name: `U${i + 1}` })));
    provider.setCount(3);
    const typed = TypedQueryable.from(
      new Queryable(User, QueryContext.fromProvider(provider)).orderBy('id')
    );
    const page = await typed.paginate(1, 2);
    expect(page.items.length).toBe(2);
    expect(page.total).toBe(3);
    expect(page.page).toBe(1);
    expect(page.size).toBe(2);
  });
});
