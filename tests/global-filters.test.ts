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
  public items!: DbSet<any>;
  constructor(filters?: any[]) {
    super({ provider: 'sqlite', connectionString: ':memory:', globalFilters: filters });
  }
}

describe('Global filters', () => {
  it('applies soft-delete filter to all queries', async () => {
    const { Item } = defineEntities();
    const ctx = new Ctx([{ entity: (Item as any), where: { condition: 'isDeleted = 0', parameters: [] } }]);
    await ctx.ensureCreated();

    const a = new (Item as any)(); a.name = 'A'; a.isDeleted = false;
    const b = new (Item as any)(); b.name = 'B'; b.isDeleted = true;
    (ctx as any)['items'].add(a);
    (ctx as any)['items'].add(b);
    await ctx.saveChanges();

    const all = await (ctx as any)['items'].toArray();
    expect(all.map((x: any) => x.name)).toEqual(['A']);

    const maybe = await (ctx as any)['items'].where((i: any) => i.name === 'B').firstOrDefault();
    expect(maybe).toBeNull();

    await ctx.dispose();
  });
});


