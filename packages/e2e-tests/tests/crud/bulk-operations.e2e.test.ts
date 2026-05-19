import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

@Entity({ name: 'bulk_items' })
class BulkItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'number' })
  quantity!: number;
}

class TestDbContext extends DbContext {}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))(
  'E2E Bulk Operations - %s',
  (providerName) => {
    let harness: any;

    let provider: any;
    let context: TestDbContext;

    beforeEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;
      ({ harness, provider } = await setupTestDatabase(providerName as any));
      context = new TestDbContext({ provider });
      await context.ensureCreated();
    });

    afterEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;
      await dropTables(provider, ['bulk_items']);
      await context.dispose();
      await teardownTestDatabase(harness);
    });

    it('should insertMany() and read all rows back', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const set = context.set(BulkItem);
      const items: BulkItem[] = [1, 2, 3].map((n) => {
        const i = new BulkItem();
        i.name = `item-${n}`;
        i.quantity = n * 10;
        return i;
      });

      await set.insertMany(items);

      const all = await set.toArray();
      expect(all).toHaveLength(3);
      expect(all.map((x) => x.quantity).sort((a, b) => a - b)).toEqual([10, 20, 30]);
    });

    it('should updateMany() and reflect changes', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const set = context.set(BulkItem);
      const items: BulkItem[] = [1, 2].map((n) => {
        const i = new BulkItem();
        i.name = `item-${n}`;
        i.quantity = n;
        return i;
      });
      const inserted = await set.insertMany(items);

      for (const item of inserted) {
        item.quantity *= 100;
      }
      await set.updateMany(inserted);

      const all = await set.toArray();
      expect(all.map((x) => x.quantity).sort((a, b) => a - b)).toEqual([100, 200]);
    });

    it('should upsertMany() inserting new and updating existing rows', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const set = context.set(BulkItem);

      const first = new BulkItem();
      first.name = 'existing';
      first.quantity = 5;
      const [inserted] = await set.insertMany([first]);

      inserted.quantity = 99;

      const newItem = new BulkItem();
      newItem.name = 'new-via-upsert';
      newItem.quantity = 7;

      await set.upsertMany([inserted, newItem]);

      const all = await set.toArray();
      expect(all).toHaveLength(2);
      const existing = all.find((x) => x.name === 'existing');
      expect(existing?.quantity).toBe(99);
      const fresh = all.find((x) => x.name === 'new-via-upsert');
      expect(fresh?.quantity).toBe(7);
    });
  }
);
