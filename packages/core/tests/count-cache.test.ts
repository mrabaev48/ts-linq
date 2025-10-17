import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { DatabaseProvider } from '../src/DatabaseProvider';
import type { SqlDialect } from '../src/query/SqlDialect';
import type { SqlParameter } from '../src/types';
class ProviderStub extends DatabaseProvider {
  private tables = new Map<string, { rows: any[]; pk?: string }>();
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(
    entityMetadata: ReturnType<typeof MetadataStorage.getEntity>
  ): Promise<void> {
    if (!entityMetadata) return;
    const table = entityMetadata.tableName;
    const pk = entityMetadata.primaryKeys[0];
    if (!this.tables.has(table)) this.tables.set(table, { rows: [], pk });
  }
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
  public async insert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const table = meta.tableName;
    const slot = this.tables.get(table)!;
    const pk = meta.primaryKeys[0];
    const copy: any = { ...(entity as any) };
    if (pk && (copy[pk] === undefined || copy[pk] === null)) {
      copy[pk] = (slot.rows.length ? slot.rows[slot.rows.length - 1][pk] || 0 : 0) + 1;
      (entity as any)[pk] = copy[pk];
    }
    slot.rows.push(copy);
    return entity;
  }
  public async update<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const table = meta.tableName;
    const pk = meta.primaryKeys[0];
    const slot = this.tables.get(table)!;
    const idx = slot.rows.findIndex((r) => r[pk] === (entity as any)[pk]);
    if (idx >= 0) slot.rows[idx] = { ...(entity as any) };
    return entity;
  }
  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const table = meta.tableName;
    const pk = meta.primaryKeys[0];
    const slot = this.tables.get(table)!;
    const idx = slot.rows.findIndex((r) => r[pk] === (entity as any)[pk]);
    if (idx >= 0) slot.rows.splice(idx, 1);
  }
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
  protected async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    const countMatch = /SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)/i.exec(sql);
    if (countMatch) {
      const table = countMatch[1];
      const slot = this.tables.get(table);
      const n = slot ? slot.rows.length : 0;
      return [{ count: n }] as unknown as T[];
    }
    const from = /FROM\s+(\w+)/i.exec(sql);
    if (from) {
      const table = from[1];
      const slot = this.tables.get(table);
      return (slot?.rows.slice() as unknown as T[]) || [];
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

function defineEntities() {
  @Entity()
  class CItem {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  return { CItem };
}

class Ctx extends DbContext {
  public citems!: DbSet<InstanceType<ReturnType<typeof defineEntities>['CItem']>>;
  constructor(ttl: number) {
    const provider = new ProviderStub('');
    super({ provider, performance: { enableCountCache: true, countCacheTtlMs: ttl } } as any);
  }
}

describe('count() cache TTL', () => {
  let CItem: ReturnType<typeof defineEntities>['CItem'];
  beforeEach(() => MetadataStorage.getInstance().clear());

  it('returns cached value within TTL and refreshes after TTL', async () => {
    const e = defineEntities();
    CItem = e.CItem;
    const ctx = new Ctx(50);
    await ctx.ensureCreated();

    // seed 1
    const a = new CItem();
    a.name = 'A';
    ctx.set(CItem).add(a);
    await ctx.saveChanges();

    const q = ctx.set(CItem);
    const c1 = await q.count();
    expect(c1).toBe(1);

    // add more but read before TTL expires -> cached
    const b = new CItem();
    b.name = 'B';
    ctx.set(CItem).add(b);
    await ctx.saveChanges();
    const c2 = await q.count();
    expect(c2).toBe(1);

    // wait TTL then count should refresh
    await new Promise((res) => setTimeout(res, 70));
    const c3 = await q.count();
    expect(c3).toBe(2);

    await ctx.dispose();
  });
});
