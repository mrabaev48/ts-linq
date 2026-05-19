import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

@Entity({ name: 'paged_items' })
class PagedItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  label!: string;
}

class TestDbContext extends DbContext {}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))('E2E Pagination - %s', (providerName) => {
  let harness: any;

  let provider: any;
  let context: TestDbContext;

  beforeAll(async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    ({ harness, provider } = await setupTestDatabase(providerName as any));
    context = new TestDbContext({ provider });
    await context.ensureCreated();

    const set = context.set(PagedItem);
    for (let i = 1; i <= 10; i++) {
      const item = new PagedItem();
      item.label = `item-${i}`;
      set.add(item);
    }
    await context.saveChanges();
  });

  afterAll(async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    await dropTables(provider, ['paged_items']);
    await context.dispose();
    await teardownTestDatabase(harness);
  });

  it('should return correct items and metadata for page 1', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;

    const result = await context.set(PagedItem).orderBy('id').paginate(1, 3);

    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(10);
    expect(result.page).toBe(1);
    expect(result.size).toBe(3);
  });

  it('should return non-overlapping items on page 2', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;

    const page1 = await context.set(PagedItem).orderBy('id').paginate(1, 3);
    const page2 = await context.set(PagedItem).orderBy('id').paginate(2, 3);

    const page1Ids = new Set(page1.items.map((x) => x.id));
    const overlap = page2.items.filter((x) => page1Ids.has(x.id));
    expect(overlap).toHaveLength(0);
  });

  it('should return the partial last page correctly', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;

    // 10 items, page size 3 → page 4 has 1 item (items 10..10)
    const lastPage = await context.set(PagedItem).orderBy('id').paginate(4, 3);

    expect(lastPage.items).toHaveLength(1);
    expect(lastPage.total).toBe(10);
  });

  it('should return empty items for a page beyond total', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;

    const beyond = await context.set(PagedItem).orderBy('id').paginate(99, 3);

    expect(beyond.items).toHaveLength(0);
    expect(beyond.total).toBe(10);
  });
});
