import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { DbSet } from '../src/context/DbSet';
import { Entity } from '../src/decorators/Entity';
import { Column } from '../src/decorators/Column';
import { PrimaryKey } from '../src/decorators/PrimaryKey';

@Entity({ name: 'Items' })
class Item {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class TestContext extends DbContext {
  public items!: DbSet<Item>; // auto DbSet
  constructor() {
    super({ connectionString: ':memory:', provider: 'sqlite' });
  }
}

describe('Result-based try methods', () => {
  test('trySaveChanges returns ok on success', async () => {
    // Ensure metadata is rehydrated before context initialization
    new Item();
    const ctx = new TestContext();
    await ctx.ensureCreated();
    const item = new Item();
    item.name = 'ok';
    ctx.set(Item).add(item);
    const res = await ctx.trySaveChanges();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBeGreaterThan(0);
    await ctx.dispose();
  });
});
