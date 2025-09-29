import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { ProviderStub } from './_stubs/ProviderStub';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

function defineEntity() {
  @Entity()
  class TItem {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  return { TItem };
}

class AppCtx extends DbContext {
  public items!: DbSet<InstanceType<ReturnType<typeof defineEntity>['TItem']>>;
  constructor() {
    super({
      connectionString: ':memory:',
      provider: new ProviderStub(':memory:'),
      performance: {
        enableEntityCache: true,
        entityCacheSize: 100,
        enableCountCache: true,
        countCacheTtlMs: 60000
      }
    });
  }
}

describe('Transaction-aware cache invalidation', () => {
  let Item: ReturnType<typeof defineEntity>['TItem'];
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    const e = defineEntity();
    Item = e.TItem;
  });

  it('clears count() cache on commit', async () => {
    const ctx = new AppCtx();
    await ctx.ensureCreated();

    // seed: 1 row
    const a = new Item();
    a.name = 'A';
    ctx.set(Item).add(a);
    await ctx.saveChanges();

    const c1 = await ctx.set(Item).count(); // populate count cache => 1
    expect(c1).toBe(1);

    // begin tx, insert second row, then commit
    await ctx.beginTransaction();
    const b = new Item();
    b.name = 'B';
    ctx.set(Item).add(b);
    await ctx.saveChanges();
    await ctx.commitTransaction(); // should clear global count cache

    const c2 = await ctx.set(Item).count();
    expect(c2).toBe(2);

    await ctx.dispose();
  });

  it('clears L2 entity cache on rollback', async () => {
    const ctx = new AppCtx();
    await ctx.ensureCreated();

    const it = new Item();
    it.name = 'A';
    ctx.set(Item).add(it);
    await ctx.saveChanges();

    // materialize to populate L2 cache
    const first = await ctx.set(Item).first();
    expect(first.name).toBe('A');

    // update within tx, then rollback
    await ctx.beginTransaction();
    first.name = 'B';
    ctx.set(Item).update(first);
    await ctx.saveChanges();
    await ctx.rollbackTransaction(); // should clear L2 cache

    const after = await ctx.set(Item).first();
    expect(after.name).toBe('A'); // not the stale 'B'

    await ctx.dispose();
  });
});
