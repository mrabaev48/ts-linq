import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { ProviderStub } from './_stubs/ProviderStub';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

function defineEntities() {
  @Entity()
  class PItem {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  return { PItem };
}

class PContext extends DbContext {
  public pitems!: DbSet<InstanceType<ReturnType<typeof defineEntities>['PItem']>>;
  constructor() {
    super({
      provider: new ProviderStub(':memory:')
    });
  }
}

describe('Pagination helpers', () => {
  let ctx: PContext;
  let PItem: ReturnType<typeof defineEntities>['PItem'];
  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    const e = defineEntities();
    PItem = e.PItem;
    ctx = new PContext();
    await ctx.ensureCreated();
    // seed 10 items
    for (let i = 1; i <= 10; i++) {
      const it = new PItem();
      it.name = `N${i}`;
      ctx.set(PItem).add(it);
      await ctx.saveChanges();
    }
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('paginate(page,size) returns correct slice and total', async () => {
    const page = await ctx
      .set(PItem)
      .orderBy((x) => x.id)
      .paginate(2, 3);
    expect(page.page).toBe(2);
    expect(page.size).toBe(3);
    expect(page.total).toBe(10);
    expect(page.items.map((i) => i.name)).toEqual(['N4', 'N5', 'N6']);
  });

  it('keysetPaginate(key, after, size) returns correct window and nextAfter', async () => {
    const q = ctx
      .set(PItem)
      .orderBy((x: InstanceType<ReturnType<typeof defineEntities>['PItem']>) => x.id);
    const p1 = await q.keysetPaginate('id', null, 4);
    expect(p1.items).toHaveLength(4);
    expect(p1.items[0].name).toBe('N1');
    const p2 = await q.keysetPaginate('id', p1.nextAfter, 4);
    expect(p2.items.map((i) => i.name)).toEqual(['N5', 'N6', 'N7', 'N8']);
  });
});
