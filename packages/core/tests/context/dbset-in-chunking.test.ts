import { DbContext } from '../../src/context/DbContext';
import { Entity } from '../../src/decorators/Entity';
import { Column } from '../../src/decorators/Column';
import { PrimaryKey } from '../../src/decorators/PrimaryKey';
import { ProviderStub } from '../_stubs/ProviderStub';

@Entity({ name: 'items' })
class Item {
  @PrimaryKey()
  @Column('INTEGER')
  id!: number;

  @Column('TEXT')
  group!: string;
}

class Ctx extends DbContext {
  public get items() {
    return this.set(Item);
  }
  constructor() {
    super({ provider: new ProviderStub(':mem:'), performance: { inClauseChunkSize: 500 } } as any);
  }
}

describe('DbSet IN dedupe & chunking', () => {
  test('deduplicates values and handles empty', async () => {
    const ctx = new Ctx();
    await ctx.provider.createTable(Item as unknown as any);
    await ctx.items.insertMany([
      { id: 1, group: 'A' } as Item,
      { id: 2, group: 'B' } as Item,
      { id: 3, group: 'A' } as Item
    ]);

    const resEmpty = await ctx.items.findWhereIn('id', []);
    expect(resEmpty).toEqual([]);

    const res = await ctx.items.findWhereIn('id', [1, 1, 2, 2, 3]);
    expect(res.map((x) => x.id).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  test('chunks large IN lists', async () => {
    const ctx = new Ctx();
    await ctx.provider.createTable(Item as unknown as any);
    const many: Item[] = [];
    for (let i = 1; i <= 2505; i++) many.push({ id: i, group: i % 2 ? 'A' : 'B' } as Item);
    await ctx.items.insertMany(many);

    const ids = Array.from({ length: 2505 }, (_, i) => i + 1);
    const res = await ctx.items.findByIds(ids as any);
    expect(res.length).toBe(2505);
  });
});
