/**
 * Integration tests — Batching / MaxBatchSize (P2-46).
 *
 * Verifies:
 * - maxBatchSize(n) flows through DbContextOptionsBuilder → DbContextOptions
 * - saveChanges() uses the batch path when maxBatchSize is configured
 * - Fewer executeQuery/executeNonQuery calls with batch vs per-row
 * - Generated PKs are written back to entity objects after batch INSERT
 * - Mixed insert/update/delete works in a single saveChanges()
 * - Per-row path (no maxBatchSize) is not affected (no regression)
 */
import 'reflect-metadata';

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext, DbContextOptionsBuilder } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';

// ── Entity fixture ────────────────────────────────────────────────────────────

@Entity({ name: 'bt_orders' })
class BtOrder {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  product!: string;

  @Column({ type: 'number' })
  qty!: number;
}

class BtContext extends DbContext {
  orders = this.set(BtOrder);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrders(count: number): BtOrder[] {
  return Array.from({ length: count }, (_, i) => {
    const o = new BtOrder();
    o.product = `product-${i}`;
    o.qty = i + 1;
    return o;
  });
}

function makeCtx(maxBatchSize?: number): { ctx: BtContext; provider: TestProvider } {
  const provider = new TestProvider(':memory:');
  let builder = new DbContextOptionsBuilder({ provider });
  if (maxBatchSize !== undefined) builder = builder.maxBatchSize(maxBatchSize) as any;
  const opts = (builder as DbContextOptionsBuilder).build();
  const ctx = new BtContext(opts);
  return { ctx, provider };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Batching / MaxBatchSize — integration (P2-46)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maxBatchSize() is propagated to DbContextOptions', () => {
    const provider = new TestProvider(':memory:');
    const opts = new DbContextOptionsBuilder({ provider }).maxBatchSize(50).build();
    expect((opts as any).maxBatchSize).toBe(50);
  });

  it('without maxBatchSize, per-row insert path is used', async () => {
    const { ctx, provider } = makeCtx();
    await ctx.ensureCreated();

    const insertSpy = jest.spyOn(provider, 'insert');
    const orders = makeOrders(5);
    for (const o of orders) ctx.orders.add(o);
    await ctx.saveChanges();

    expect(insertSpy).toHaveBeenCalledTimes(5);
  });

  it('with maxBatchSize set, batch executeQuery is called instead of per-row insert', async () => {
    const { ctx, provider } = makeCtx(50);
    await ctx.ensureCreated();

    const insertSpy = jest.spyOn(provider, 'insert');
    const executeQuerySpy = jest.spyOn(provider, 'executeQuery');
    const orders = makeOrders(10);
    for (const o of orders) ctx.orders.add(o);
    await ctx.saveChanges();

    // Batch path used — individual insert() should NOT be called
    expect(insertSpy).not.toHaveBeenCalled();
    // executeQuery called once (all 10 fit in one batch of 50)
    expect(executeQuerySpy).toHaveBeenCalledTimes(1);
  });

  it('200 inserts with maxBatchSize(50) result in exactly 4 batch calls', async () => {
    const { ctx, provider } = makeCtx(50);
    await ctx.ensureCreated();

    const executeQuerySpy = jest.spyOn(provider, 'executeQuery');
    const orders = makeOrders(200);
    for (const o of orders) ctx.orders.add(o);
    await ctx.saveChanges();

    expect(executeQuerySpy).toHaveBeenCalledTimes(4);
  });

  it('generated PKs are written back to entities after batch INSERT', async () => {
    const { ctx } = makeCtx(50);
    await ctx.ensureCreated();

    const orders = makeOrders(3);
    for (const o of orders) ctx.orders.add(o);
    await ctx.saveChanges();

    // Each entity should now have an auto-assigned ID
    expect(orders[0].id).toBeDefined();
    expect(orders[1].id).toBeDefined();
    expect(orders[2].id).toBeDefined();
    expect(typeof orders[0].id).toBe('number');
  });

  it('batch DELETE uses executeNonQuery (not per-row delete)', async () => {
    const { ctx, provider } = makeCtx(50);
    await ctx.ensureCreated();

    // First insert some rows
    const orders = makeOrders(5);
    for (const o of orders) ctx.orders.add(o);
    await ctx.saveChanges();

    const deleteSpy = jest.spyOn(provider, 'delete');
    const executeNonQuerySpy = jest.spyOn(provider, 'executeNonQuery');

    // Now delete them all
    for (const o of orders) {
      ctx.orders.remove(o);
    }
    await ctx.saveChanges();

    expect(deleteSpy).not.toHaveBeenCalled();
    // Batch DELETE is one executeNonQuery call
    expect(executeNonQuerySpy).toHaveBeenCalledTimes(1);
  });

  it('mixed insert/update/delete in one saveChanges() works', async () => {
    const { ctx } = makeCtx(50);
    await ctx.ensureCreated();

    // Insert initial data
    const orders = makeOrders(3);
    for (const o of orders) ctx.orders.add(o);
    await ctx.saveChanges();

    // Now: update one, delete one, add one new
    orders[0].product = 'updated-product';
    ctx.orders.update(orders[0]);
    ctx.orders.remove(orders[1]);
    const newOrder = new BtOrder();
    newOrder.product = 'brand-new';
    newOrder.qty = 99;
    ctx.orders.add(newOrder);

    const affected = await ctx.saveChanges();
    expect(affected).toBeGreaterThan(0);
  });
});
