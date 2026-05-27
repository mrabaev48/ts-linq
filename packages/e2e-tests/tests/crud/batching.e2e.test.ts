import 'reflect-metadata';

import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { DbContext, DbContextOptionsBuilder } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

@Entity({ name: 'batch_orders' })
class BatchOrder {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  product!: string;

  @Column({ type: 'number' })
  qty!: number;
}

class BatchContext extends DbContext {
  orders = this.set(BatchOrder);
}

function makeOrder(product: string, qty: number): BatchOrder {
  const o = new BatchOrder();
  o.product = product;
  o.qty = qty;
  return o;
}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))(
  'E2E Batching / MaxBatchSize — %s',
  (providerName) => {
    let harness: any;
    let provider: any;
    let ctx: BatchContext;

    beforeEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;
      ({ harness, provider } = await setupTestDatabase(providerName as any));
      const opts = new DbContextOptionsBuilder({ provider }).maxBatchSize(10).build();
      ctx = new BatchContext(opts);
      await ctx.ensureCreated();
    });

    afterEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;
      await dropTables(provider, ['batch_orders']);
      await ctx.dispose();
      await teardownTestDatabase(harness);
    });

    it('batch inserts 100 entities and returns generated IDs', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const orders = Array.from({ length: 100 }, (_, i) => makeOrder(`p-${i}`, i + 1));
      for (const o of orders) ctx.orders.add(o);
      await ctx.saveChanges();

      for (const o of orders) {
        expect(o.id).toBeDefined();
        expect(typeof o.id).toBe('number');
        expect(o.id).toBeGreaterThan(0);
      }
    });

    it('batch updates 100 entities — all rows reflect new values', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const orders = Array.from({ length: 100 }, (_, i) => makeOrder(`p-${i}`, 1));
      for (const o of orders) ctx.orders.add(o);
      await ctx.saveChanges();

      for (const o of orders) {
        o.qty = 999;
        ctx.orders.update(o);
      }
      await ctx.saveChanges();

      const all = await ctx.orders.toArray();
      expect(all.every((o) => o.qty === 999)).toBe(true);
    });

    it('batch deletes 100 entities — count drops to 0', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const orders = Array.from({ length: 100 }, (_, i) => makeOrder(`p-${i}`, i + 1));
      for (const o of orders) ctx.orders.add(o);
      await ctx.saveChanges();

      for (const o of orders) ctx.orders.remove(o);
      await ctx.saveChanges();

      const all = await ctx.orders.toArray();
      expect(all).toHaveLength(0);
    });

    it('maxBatchSize(10) produces multiple chunks for 25 inserts', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const executeQuerySpy = jest.spyOn(provider, 'executeQuery');
      const orders = Array.from({ length: 25 }, (_, i) => makeOrder(`p-${i}`, i + 1));
      for (const o of orders) ctx.orders.add(o);
      await ctx.saveChanges();

      // 25 / 10 = 3 chunks
      expect(executeQuerySpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  }
);
