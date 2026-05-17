import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { SqlDialect, SqlParameter } from '@ts-linq/types';

import { FallbackManager } from '../src/FallbackManager';
import { IncludePlanner } from '../src/IncludePlanner';
import { PaginationBuilder } from '../src/PaginationBuilder';
import { QueryBuilder } from '../src/QueryBuilder';
import { QueryExecutor } from '../src/QueryExecutor';
import { QueryModel } from '../src/QueryModel';
import { RowMaterializer } from '../src/RowMaterializer';

class Item {
  id!: number;
  name!: string;
}

class StubDialect implements SqlDialect {
  public buildSelect<T>(
    entityClass: new () => T,
    options: unknown
  ): { query: string; parameters: readonly SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass) || { tableName: (entityClass as { name: string }).name };
    const opts = options as { limit?: number; offset?: number } | undefined;
    const limit = typeof opts?.limit === 'number' ? opts.limit : undefined;
    const offset = typeof opts?.offset === 'number' ? opts.offset : 0;
    const marker = limit !== undefined ? ` /*LIMIT=${limit},OFFSET=${offset}*/` : '';
    return { query: `SELECT * FROM ${meta.tableName}${marker}`, parameters: [] };
  }
  public quoteIdentifier(id: string): string {
    return `"${id}"`;
  }
}

class StubProvider extends DatabaseProvider {
  private rows: Record<string, unknown>[] = [];
  private countValue = 0;
  private readonly dialect = new StubDialect();
  setRows(rows: Record<string, unknown>[]): void { this.rows = rows; }
  setCount(n: number): void { this.countValue = n; }
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect { return this.dialect; }
  public async insert<T extends object>(e: T): Promise<T> { return e; }
  public async update<T extends object>(e: T): Promise<T> { return e; }
  public async delete(): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> { return null; }
  public async findAll<T extends object>(): Promise<T[]> { return [] as unknown as T[]; }
  public async findWhere<T extends object>(): Promise<T[]> { return [] as unknown as T[]; }
  public async findWhereIn<T extends object>(): Promise<T[]> { return [] as unknown as T[]; }
  protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
    const m = /\/\*LIMIT=(\d+),OFFSET=(\d+)\*\//.exec(sql);
    if (m) {
      const limit = parseInt(m[1]!, 10);
      const offset = parseInt(m[2]!, 10);
      return this.rows.slice(offset, offset + limit) as unknown as T[];
    }
    return this.rows as unknown as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> { return 1; }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
  constructor() {
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    (this as unknown as { providerName: string }).providerName = 'stub';
  }
}

function buildDeps(provider: StubProvider) {
  const sqlBuilder = new QueryBuilder(provider.getDialect(), undefined, 'stub');
  const materializer = new RowMaterializer<Item>(Item, provider);
  const includePlanner = new IncludePlanner<Item>(undefined, Item);
  const fallbackManager = FallbackManager.create<Item>();
  const executor = new QueryExecutor<Item>(
    Item,
    provider,
    sqlBuilder,
    materializer,
    includePlanner,
    fallbackManager,
    undefined
  );
  return { executor };
}

describe('PaginationBuilder', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(Item, 'items');
    MetadataStorage.addColumn(Item, { propertyName: 'id', columnName: 'id', type: 'INTEGER', primaryKey: true });
    MetadataStorage.addPrimaryKey(Item, 'id');
    MetadataStorage.addColumn(Item, { propertyName: 'name', columnName: 'name', type: 'TEXT' });
  });

  describe('paginate()', () => {
    it('returns correct page slice with total', async () => {
      const provider = new StubProvider();
      provider.setRows([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
        { id: 5, name: 'E' },
      ]);
      const { executor } = buildDeps(provider);

      let countCalled = false;
      const pb = new PaginationBuilder<Item>(
        Item,
        provider,
        executor,
        [],
        undefined,
        () => new QueryModel(),
        async () => { countCalled = true; return 5; }
      );

      const result = await pb.paginate(2, 2);
      expect(result.page).toBe(2);
      expect(result.size).toBe(2);
      expect(result.total).toBe(5);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({ id: 3, name: 'C' });
      expect(result.items[1]).toMatchObject({ id: 4, name: 'D' });
      expect(countCalled).toBe(true);
    });

    it('throws when page < 1 or size < 1', async () => {
      const provider = new StubProvider();
      const { executor } = buildDeps(provider);
      const pb = new PaginationBuilder<Item>(
        Item, provider, executor, [], undefined, () => new QueryModel(), async () => 0
      );

      await expect(pb.paginate(0, 10)).rejects.toThrow('paginate requires page >= 1 and size >= 1');
      await expect(pb.paginate(1, 0)).rejects.toThrow('paginate requires page >= 1 and size >= 1');
    });

    it('page 1 starts at offset 0', async () => {
      const provider = new StubProvider();
      provider.setRows([{ id: 10, name: 'X' }, { id: 11, name: 'Y' }]);
      const { executor } = buildDeps(provider);
      const pb = new PaginationBuilder<Item>(
        Item, provider, executor, [], undefined, () => new QueryModel(), async () => 2
      );

      const result = await pb.paginate(1, 2);
      expect(result.items[0]).toMatchObject({ id: 10 });
    });
  });

  describe('keysetPaginate()', () => {
    it('throws when size < 1', async () => {
      const provider = new StubProvider();
      const { executor } = buildDeps(provider);
      const pb = new PaginationBuilder<Item>(
        Item, provider, executor, [], undefined, () => new QueryModel(), async () => 0
      );
      await expect(pb.keysetPaginate('id', null, 0)).rejects.toThrow('keysetPaginate requires size >= 1');
    });

    it('returns correct items and nextAfter when after is null', async () => {
      const provider = new StubProvider();
      provider.setRows([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
      const { executor } = buildDeps(provider);
      const pb = new PaginationBuilder<Item>(
        Item, provider, executor, [], undefined, () => new QueryModel(), async () => 0
      );

      const result = await pb.keysetPaginate('id', null, 2);
      expect(result.items).toHaveLength(2);
      expect(result.pageSize).toBe(2);
      expect(result.nextAfter).toBe(2);
    });

    it('returns null nextAfter when result is empty', async () => {
      const provider = new StubProvider();
      provider.setRows([]);
      const { executor } = buildDeps(provider);
      const pb = new PaginationBuilder<Item>(
        Item, provider, executor, [], undefined, () => new QueryModel(), async () => 0
      );

      const result = await pb.keysetPaginate('id', null, 10);
      expect(result.nextAfter).toBeNull();
      expect(result.items).toHaveLength(0);
    });
  });
});
