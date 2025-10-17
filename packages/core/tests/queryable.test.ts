import { DatabaseProvider } from '../src/DatabaseProvider';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { Queryable } from '../src/query/Queryable';
import type { SqlDialect } from '../src/query/SqlDialect';
import type { SqlParameter } from '../src/types';

class ProviderStub extends DatabaseProvider {
  private data: any[] = [];
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect {
    return {
      buildSelect: (ctor, opts) => {
        const meta = MetadataStorage.getEntity(ctor as unknown as Function)!;
        const table = meta.tableName;
        let query = `SELECT * FROM ${table}`;
        const parameters: SqlParameter[] = [];
        if (opts.where && opts.where.length) {
          query += ' WHERE ' + opts.where.map((w) => w.condition).join(' AND ');
          for (const w of opts.where) parameters.push(...w.parameters);
        }
        return { query, parameters } as const;
      }
    } as unknown as SqlDialect;
  }
  public async insert<T extends object>(e: T): Promise<T> {
    this.data.push({ ...(e as any) });
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete<T extends object>(): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return this.data.slice() as T[];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return this.data.slice() as T[];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return this.data.slice() as T[];
  }
  protected async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    const countMatch = /SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)/i.exec(sql);
    if (countMatch) {
      const n = this.data.length;
      return [{ count: n }] as unknown as T[];
    }
    const fromMatch = /FROM\s+(\w+)/i.exec(sql);
    if (fromMatch) {
      // Very naive WHERE parser for ">=" on age
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
  public async beginTransaction(): Promise<void> {
    this.inTransaction = true;
  }
  public async commitTransaction(): Promise<void> {
    this.inTransaction = false;
  }
  public async rollbackTransaction(): Promise<void> {
    this.inTransaction = false;
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

describe('Queryable', () => {
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
    q = new Queryable(E, provider);
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  it('toArray returns all', async () => {
    const res = await q.toArray();
    expect(res).toHaveLength(3);
  });

  it('where with >= translates to SQL', async () => {
    const res = await q.where((e) => e.age >= 22).toArray();
    expect(res.every((x) => x.age >= 22)).toBe(true);
  });
});
