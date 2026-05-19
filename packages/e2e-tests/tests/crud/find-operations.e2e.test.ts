import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

@Entity({ name: 'find_items' })
class FindItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'number' })
  rank!: number;

  @Column({ type: 'boolean', name: 'is_active' })
  isActive!: boolean;
}

class TestDbContext extends DbContext {}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))(
  'E2E Find Operations - %s',
  (providerName) => {
    let harness: any;
    let provider: any;
    let context: TestDbContext;

    beforeEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;
      ({ harness, provider } = await setupTestDatabase(providerName as any));
      context = new TestDbContext({ provider });
      await context.ensureCreated();

      const set = context.set(FindItem);
      for (const [name, rank, isActive] of [
        ['Alpha', 1, true],
        ['Beta', 2, false],
        ['Gamma', 3, true]
      ] as [string, number, boolean][]) {
        const item = new FindItem();
        item.name = name;
        item.rank = rank;
        item.isActive = isActive;
        set.add(item);
      }
      await context.saveChanges();
    });

    afterEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;
      await dropTables(provider, ['find_items']);
      await context.dispose();
      await teardownTestDatabase(harness);
    });

    it('should first() return the first row of an ordered set', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const item = await context.set(FindItem).orderBy('rank').first();
      expect(item).toBeDefined();
      expect(item.rank).toBe(1);
      expect(item.name).toBe('Alpha');
    });

    it('should firstOrDefault() return null when no rows match filter', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const item = await context
        .set(FindItem)
        .where((x) => x.rank > 9999)
        .firstOrDefault();
      expect(item).toBeNull();
    });

    it('should firstOrDefault() return the matching row', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const item = await context
        .set(FindItem)
        .where((x) => x.name === 'Gamma')
        .firstOrDefault();
      expect(item).not.toBeNull();
      expect(item!.rank).toBe(3);
    });

    it('should count() with where filter', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const count = await context
        .set(FindItem)
        .where((x) => x.isActive === true)
        .count();
      expect(Number(count)).toBe(2);
    });

    it('should any() return false on empty filtered set', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const exists = await context
        .set(FindItem)
        .where((x) => x.rank > 9999)
        .any();
      expect(exists).toBe(false);
    });

    it('should any() return true when matching rows exist', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const exists = await context
        .set(FindItem)
        .where((x) => x.isActive === false)
        .any();
      expect(exists).toBe(true);
    });

    it('should where() with multiple chained conditions', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const items = await context
        .set(FindItem)
        .where((x) => x.isActive === true)
        .where((x) => x.rank > 1)
        .toArray();

      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Gamma');
    });

    it('should skip() and take() produce correct pages', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const page1 = await context.set(FindItem).orderBy('rank').skip(0).take(2).toArray();
      const page2 = await context.set(FindItem).orderBy('rank').skip(2).take(2).toArray();

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
      expect(page1[0].rank).toBe(1);
      expect(page2[0].rank).toBe(3);
    });
  }
);
