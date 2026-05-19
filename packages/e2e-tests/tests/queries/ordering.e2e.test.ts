import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

@Entity({ name: 'order_items' })
class OrderItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  category!: string;

  @Column({ type: 'number' })
  score!: number;

  @Column()
  label!: string;
}

class TestDbContext extends DbContext {}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))('E2E Ordering - %s', (providerName) => {
  let harness: any;
  let provider: any;
  let context: TestDbContext;

  beforeAll(async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    ({ harness, provider } = await setupTestDatabase(providerName as any));
    context = new TestDbContext({ provider });
    await context.ensureCreated();

    const set = context.set(OrderItem);
    const seed: Array<{ category: string; score: number; label: string }> = [
      { category: 'B', score: 30, label: 'beta-high' },
      { category: 'A', score: 10, label: 'alpha-low' },
      { category: 'A', score: 50, label: 'alpha-high' },
      { category: 'B', score: 20, label: 'beta-low' },
      { category: 'A', score: 30, label: 'alpha-mid' }
    ];
    for (const s of seed) {
      const item = new OrderItem();
      item.category = s.category;
      item.score = s.score;
      item.label = s.label;
      set.add(item);
    }
    await context.saveChanges();
  });

  afterAll(async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    await dropTables(provider, ['order_items']);
    await context.dispose();
    await teardownTestDatabase(harness);
  });

  it('should orderBy ascending', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;

    const items = await context.set(OrderItem).orderBy('score').toArray();
    for (let i = 1; i < items.length; i++) {
      expect(items[i].score).toBeGreaterThanOrEqual(items[i - 1].score);
    }
    expect(items[0].score).toBe(10);
  });

  it('should orderByDescending', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;

    const items = await context.set(OrderItem).orderByDescending('score').toArray();
    for (let i = 1; i < items.length; i++) {
      expect(items[i].score).toBeLessThanOrEqual(items[i - 1].score);
    }
    expect(items[0].score).toBe(50);
  });

  it('should thenBy for stable secondary sort', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;

    const items = await context.set(OrderItem).orderBy('category').thenBy('score').toArray();

    const aItems = items.filter((x) => x.category === 'A');
    const bItems = items.filter((x) => x.category === 'B');

    // A comes before B
    const firstB = items.findIndex((x) => x.category === 'B');
    const lastA = items.map((x) => x.category).lastIndexOf('A');
    expect(lastA).toBeLessThan(firstB);

    // Within A: ascending score
    for (let i = 1; i < aItems.length; i++) {
      expect(aItems[i].score).toBeGreaterThanOrEqual(aItems[i - 1].score);
    }
    // Within B: ascending score
    for (let i = 1; i < bItems.length; i++) {
      expect(bItems[i].score).toBeGreaterThanOrEqual(bItems[i - 1].score);
    }
  });

  it('should thenByDescending for secondary sort descending', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;

    const items = await context
      .set(OrderItem)
      .orderBy('category')
      .thenByDescending('score')
      .toArray();

    const aItems = items.filter((x) => x.category === 'A');
    // Within A: descending score
    for (let i = 1; i < aItems.length; i++) {
      expect(aItems[i].score).toBeLessThanOrEqual(aItems[i - 1].score);
    }
  });

  it('should orderBy combined with where', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;

    const items = await context
      .set(OrderItem)
      .where((x) => x.category === 'A')
      .orderByDescending('score')
      .toArray();

    expect(items.every((x) => x.category === 'A')).toBe(true);
    expect(items[0].score).toBe(50);
  });
});
