import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

@Entity({ name: 'agg_items' })
class AggItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'number' })
  value!: number;
}

class TestDbContext extends DbContext {}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))('E2E Aggregates - %s', (providerName) => {
  let harness: any;

  let provider: any;
  let context: TestDbContext;

  beforeEach(async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;

    ({ harness, provider } = await setupTestDatabase(providerName as any));
    context = new TestDbContext({ provider });
    await context.ensureCreated();

    const set = context.set(AggItem);
    for (const v of [10, 20, 30, 40, 50]) {
      const item = new AggItem();
      item.name = `item-${v}`;
      item.value = v;
      set.add(item);
    }
    await context.saveChanges();
  });

  afterEach(async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    await dropTables(provider, ['agg_items']);
    await context.dispose();
    await teardownTestDatabase(harness);
  });

  it('should return correct count()', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    const count = await context.set(AggItem).count();
    expect(Number(count)).toBe(5);
  });

  it('should return true for any() when rows exist', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    const exists = await context.set(AggItem).any();
    expect(exists).toBe(true);
  });

  it('should return false for any() when filter matches nothing', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    const exists = await context
      .set(AggItem)
      .where((i) => i.value > 9999)
      .any();
    expect(exists).toBe(false);
  });

  it('should return correct sum()', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    const total = await context.set(AggItem).sum('value');
    expect(Number(total)).toBe(150);
  });

  it('should return correct min()', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    const minVal = await context.set(AggItem).min('value');
    expect(Number(minVal)).toBe(10);
  });

  it('should return correct max()', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    const maxVal = await context.set(AggItem).max('value');
    expect(Number(maxVal)).toBe(50);
  });

  it('should return correct average()', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    const avg = await context.set(AggItem).average('value');
    expect(Number(avg)).toBe(30);
  });
});
