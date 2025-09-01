import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

function defineEntity() {
  @Entity()
  class CUser {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  return { CUser };
}

class CacheCtx extends DbContext {
  public cusers!: DbSet<any>;
  constructor() {
    super({ provider: 'sqlite', connectionString: ':memory:', performance: { enableEntityCache: true, entityCacheSize: 100 } });
  }
}

describe('L2 Entity Cache', () => {
  let ctx: CacheCtx;
  let CUser: ReturnType<typeof defineEntity>['CUser'];
  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    const e = defineEntity();
    CUser = e.CUser;
    ctx = new CacheCtx();
    await ctx.ensureCreated();
  });
  afterEach(async () => { await ctx.dispose(); });

  it('caches entity on first load and returns same instance next time', async () => {
    const u = new CUser();
    u.name = 'A';
    ctx.cusers.add(u);
    await ctx.saveChanges();

    const first = await ctx.set(CUser).find(u.id);
    const second = await ctx.set(CUser).find(u.id);
    expect(first).toBe(second);
  });

  it('updates cache on update and invalidates on delete', async () => {
    const u = new CUser();
    u.name = 'A';
    ctx.cusers.add(u);
    await ctx.saveChanges();

    const first = await ctx.set(CUser).find(u.id);
    expect(first!.name).toBe('A');

    // update
    first!.name = 'B';
    ctx.cusers.update(first!);
    await ctx.saveChanges();

    const afterUpdate = await ctx.set(CUser).find(u.id);
    expect(afterUpdate!.name).toBe('B');
    expect(afterUpdate).toBe(first); // same instance updated in cache

    // delete
    ctx.cusers.remove(afterUpdate!);
    await ctx.saveChanges();

    const afterDelete = await ctx.set(CUser).find(u.id);
    expect(afterDelete).toBeNull();
  });
});


