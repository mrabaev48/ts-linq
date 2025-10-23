import 'reflect-metadata';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { Queryable } from '../src/query/Queryable';
import { InMemoryCountCache } from '../src/query/CountCache';
import type { GlobalFilter } from '../src/types';
import type { SqlDialect } from '../src/query/SqlDialect';
import type { SqlParameter } from '../src/types';
import { Entity, Column, PrimaryKey } from '../src';
import { DatabaseProvider } from '../src/DatabaseProvider';

class ProviderStub extends DatabaseProvider {
  private data: any[] = [];
  private buildCalls = 0;
  private lastQuery = '';
  private countCalls = 0;
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect {
    return {
      buildSelect: (ctor, opts) => {
        this.buildCalls++;
        const meta = MetadataStorage.getEntity(ctor as unknown as Function)!;
        const table = meta.tableName;
        let query = `SELECT * FROM ${table}`;
        const parameters: SqlParameter[] = [];
        if (opts.where && opts.where.length) {
          query += ' WHERE ' + opts.where.map((w) => w.condition).join(' AND ');
          for (const w of opts.where) parameters.push(...w.parameters);
        }
        this.lastQuery = query;
        return { query, parameters } as const;
      }
    } as unknown as SqlDialect;
  }
  public async insert<T extends object>(e: T): Promise<T> {
    this.data.push({ ...(e as any) });
    return e;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return this.data.slice() as T[];
  }
  public getBuildCalls() {
    return this.buildCalls;
  }
  public getLastQuery() {
    return this.lastQuery;
  }
  public getCountCalls() {
    return this.countCalls;
  }
  protected async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    const countMatch = /SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)/i.exec(sql);
    if (countMatch) {
      this.countCalls++;
      return [{ count: this.data.length }] as unknown as T[];
    }
    const fromMatch = /FROM\s+(\w+)/i.exec(sql);
    if (fromMatch) {
      const geMatch = /WHERE\s+(\w+)\s*>\s*\?/i.exec(sql) || /WHERE\s+(\w+)\s*>=\s*\?/i.exec(sql);
      if (geMatch) {
        const col = geMatch[1];
        const val = Number(params[0]);
        return this.data.filter((r) => r[col] >= val) as T[];
      }
      return this.data.slice() as T[];
    }
    return [] as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
}

function createEntity() {
  @Entity()
  class E {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column() name!: string;
    @Column() age!: number;
  }
  return E;
}

describe('Queryable advanced', () => {
  let provider: ProviderStub;
  let E: ReturnType<typeof createEntity>;
  let q: Queryable<InstanceType<ReturnType<typeof createEntity>>>;

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    E = createEntity();
    provider = new ProviderStub('');
    for (let i = 1; i <= 3; i++) {
      const e = new E();
      e.name = `N${i}`;
      e.age = 20 + i;
      await provider.insert(e, E);
    }
    q = new Queryable(E, provider, undefined, undefined, {
      enableCountCache: true,
      countCacheTtlMs: 1000
    });
  });

  it('count() uses cache on repeated calls without where change', async () => {
    const c1 = await q.where((e) => e.age >= 21).count();
    const before = provider.getBuildCalls();
    const c2 = await q.where((e) => e.age >= 21).count();
    const after = provider.getBuildCalls();
    expect(c1).toBe(c2);
    expect(after).toBe(before); // dialect not called again for count
  });

  it('external count cache is used and updated', async () => {
    const ext = new InMemoryCountCache(10_000, 10);
    const qExt = new Queryable(
      E,
      provider,
      undefined,
      undefined,
      { enableCountCache: true, countCacheTtlMs: 10_000 },
      undefined,
      undefined,
      ext
    );
    const first = await qExt.where((e) => (e as any).age >= 21).count();
    const beforeCalls = provider.getBuildCalls();
    const second = await qExt.where((e) => (e as any).age >= 21).count();
    const afterCalls = provider.getBuildCalls();
    expect(first).toBe(second);
    expect(afterCalls).toBe(beforeCalls); // external cache prevents rebuild/execute
  });

  it('external count cache TTL expiration triggers new count call', async () => {
    const ext = new InMemoryCountCache(1, 10); // 1ms TTL
    const qExt = new Queryable(
      E,
      provider,
      undefined,
      undefined,
      { enableCountCache: true, countCacheTtlMs: 1 },
      undefined,
      undefined,
      ext
    );
    const c0 = provider.getCountCalls();
    await qExt.count();
    const c1 = provider.getCountCalls();
    expect(c1).toBeGreaterThan(c0);
    // wait for TTL
    await new Promise((r) => setTimeout(r, 5));
    await qExt.count();
    const c2 = provider.getCountCalls();
    expect(c2).toBeGreaterThan(c1);
  });

  it('external count cache maxSize evicts old entries (FIFO)', async () => {
    const ext = new InMemoryCountCache(10_000, 1); // capacity=1
    const qBase = new Queryable(
      E,
      provider,
      undefined,
      undefined,
      { enableCountCache: true, countCacheTtlMs: 10_000 },
      undefined,
      undefined,
      ext
    );
    const baseCalls = provider.getCountCalls();
    await qBase.where((e) => (e as any).age >= 21).count(); // key1
    await qBase.where((e) => (e as any).age >= 22).count(); // key2, evict key1
    const callsAfterTwo = provider.getCountCalls();
    await qBase.where((e) => (e as any).age >= 21).count(); // key1 again → new count
    const endCalls = provider.getCountCalls();
    expect(callsAfterTwo).toBeGreaterThan(baseCalls);
    expect(endCalls).toBeGreaterThan(callsAfterTwo);
  });

  it('global filters: soft delete is applied and query executes', async () => {
    // Prepare metadata for soft-delete column
    const meta = MetadataStorage.getEntity(E)!;
    meta.columns.push({
      propertyName: 'isDeleted',
      columnName: 'isDeleted',
      type: 'INTEGER'
    } as any);
    // Add an explicit global filter by age
    const gf: GlobalFilter = {
      entity: E,
      where: { condition: 'age >= 22', parameters: [] }
    };
    // Construct Queryable with global filters and softDelete
    const qWithFilters = new Queryable(
      E,
      Object.assign(provider, { softDelete: { enabled: true, column: 'isDeleted' } }),
      undefined,
      undefined,
      undefined,
      undefined,
      [gf]
    );
    const res = await qWithFilters.toArray();
    const sql = provider.getLastQuery();
    expect(Array.isArray(res)).toBe(true);
    expect(sql).toContain('WHERE');
    expect(sql).toContain('isDeleted');
  });

  it('abort via AbortSignal throws', async () => {
    const ac = new AbortController();
    const q2 = new Queryable(E, provider).withAbort(ac.signal);
    ac.abort();
    await expect(q2.any()).rejects.toThrow(/aborted/);
  });

  it('groupBy().having() attaches HAVING clause without throwing', async () => {
    // We do not test SQL rendering, only that the chain doesn't crash
    const res = await q
      .groupBy((e) => (e as any).age)
      .having((e) => (e as any).age >= 21)
      .toArray();
    expect(Array.isArray(res)).toBe(true);
  });

  it('where AND/OR combinations result in consistent SQL', async () => {
    await q
      .where((e) => (e as any).age >= 21)
      .where((e) => (e as any).age >= 22)
      .toArray();
    const sql1 = provider.getLastQuery();

    await q.where((e) => (e as any).age >= 21).toArray();
    const sql2 = provider.getLastQuery();

    expect(sql1).toContain('WHERE');
    expect(sql1).toContain('AND');
    expect(sql2).toContain('WHERE');
  });

  it('having without groupBy throws', () => {
    expect(() => q.having(() => true)).toThrow(/requires a preceding groupBy/);
  });

  it('SQL generation cache: hit on identical query across instances', async () => {
    const before = provider.getBuildCalls();
    await new Queryable(E, provider).where((e) => (e as any).age >= 22).toArray();
    const mid = provider.getBuildCalls();
    await new Queryable(E, provider).where((e) => (e as any).age >= 22).toArray();
    const after = provider.getBuildCalls();
    expect(mid).toBeGreaterThan(before);
    expect(after).toBe(mid); // cache hit, no rebuild
  });

  it('SQL generation cache: miss when query differs', async () => {
    const before = provider.getBuildCalls();
    await new Queryable(E, provider).where((e) => (e as any).age >= 21).toArray();
    await new Queryable(E, provider).where((e) => (e as any).age >= 23).toArray();
    const after = provider.getBuildCalls();
    expect(after).toBeGreaterThan(before + 0); // at least one additional build
  });

  it('keysetPaginate returns nextAfter and respects after (using age)', async () => {
    const page1 = await new Queryable(E, provider)
      .orderBy((e) => (e as any).age)
      .keysetPaginate('age' as any, null, 2);
    expect(page1.items.length).toBeGreaterThanOrEqual(1);
    const page2 = await new Queryable(E, provider)
      .orderBy((e) => (e as any).age)
      .keysetPaginate('age' as any, page1.nextAfter as unknown as number, 2);
    expect(page2.items.length).toBeGreaterThanOrEqual(0);
  });

  it('keysetPaginate throws on size < 1', async () => {
    await expect(
      new Queryable(E, provider).orderBy((e) => (e as any).id).keysetPaginate('id' as any, null, 0)
    ).rejects.toThrow(/size >= 1/);
  });

  it('first and firstOrDefault behave correctly', async () => {
    const first = await new Queryable(E, provider).orderBy((e) => (e as any).id).first();
    expect(first).toBeTruthy();
    await expect(new Queryable(E, provider).where(() => false as any).first()).rejects.toThrow(
      /no elements/
    );
    const maybe = await new Queryable(E, provider).where(() => false as any).firstOrDefault();
    expect(maybe).toBeNull();
  });

  it('single/singleOrDefault/tryFirst/trySingle cover positive/negative paths', async () => {
    const one = await new Queryable(E, provider).where((e) => (e as any).age >= 23).single();
    expect(one).toBeTruthy();
    await expect(new Queryable(E, provider).where(() => false as any).single()).rejects.toThrow(
      /no elements/
    );
    await expect(
      new Queryable(E, provider).where((e) => (e as any).age >= 21).single()
    ).rejects.toThrow(/more than one/);

    const t1 = await new Queryable(E, provider).where(() => false as any).tryFirst();
    expect(t1.ok).toBe(false);
    const t2 = await new Queryable(E, provider).where(() => false as any).trySingle();
    expect(t2.ok).toBe(false);
  });

  it('include invalid relationship throws', () => {
    expect(() => new Queryable(E, provider).include((e) => (e as any).nonExisting)).toThrow(
      /Invalid include/
    );
  });
});
