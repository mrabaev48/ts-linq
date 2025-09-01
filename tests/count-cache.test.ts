import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

function defineEntities() {
  @Entity()
  class CItem {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  return { CItem };
}

class Ctx extends DbContext {
  public citems!: DbSet<any>;
  constructor(ttl: number) {
    super({ provider: 'sqlite', connectionString: ':memory:', performance: { enableCountCache: true, countCacheTtlMs: ttl } });
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
    const a = new CItem(); a.name = 'A';
    ctx.citems.add(a); await ctx.saveChanges();

    const q = ctx.set(CItem);
    const c1 = await q.count();
    expect(c1).toBe(1);

    // add more but read before TTL expires -> cached
    const b = new CItem(); b.name = 'B';
    ctx.citems.add(b); await ctx.saveChanges();
    const c2 = await q.count();
    expect(c2).toBe(1);

    // wait TTL then count should refresh
    await new Promise(res => setTimeout(res, 70));
    const c3 = await q.count();
    expect(c3).toBe(2);

    await ctx.dispose();
  });
});


