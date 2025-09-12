import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';

function defineEntities() {
  @Entity()
  class Item {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
    @Column({ type: 'BOOLEAN', nullable: false, defaultValue: false }) isDeleted!: boolean;
  }
  return { Item };
}

class Ctx extends DbContext {
  public items!: DbSet<InstanceType<ReturnType<typeof defineEntities>['Item']>>;
  constructor(filters?: Array<{ entity: Function; where: { condition: string; parameters: [] } }>) {
    super({ provider: 'sqlite', connectionString: ':memory:', globalFilters: filters });
  }
}

describe('Global filters', () => {
  it('applies soft-delete filter to all queries', async () => {
    const { Item } = defineEntities();
    const ctx = new Ctx([{ entity: Item, where: { condition: 'isDeleted = 0', parameters: [] } }]);
    await ctx.ensureCreated();

    const a = new Item();
    a.name = 'A';
    a.isDeleted = false;
    const b = new Item();
    b.name = 'B';
    b.isDeleted = true;
    (ctx as unknown as { items: DbSet<InstanceType<typeof Item>> }).items.add(a);
    (ctx as unknown as { items: DbSet<InstanceType<typeof Item>> }).items.add(b);
    await ctx.saveChanges();

    const all = await (
      ctx as unknown as { items: DbSet<InstanceType<typeof Item>> }
    ).items.toArray();
    expect(all.map((x) => x.name)).toEqual(['A']);

    const maybe = await (ctx as unknown as { items: DbSet<InstanceType<typeof Item>> }).items
      .where((i) => i.name === 'B')
      .firstOrDefault();
    expect(maybe).toBeNull();

    await ctx.dispose();
  });
});
