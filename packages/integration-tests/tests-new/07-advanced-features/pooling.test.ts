import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import {
  addDbContextFactory,
  addDbContextPool,
  DbContext,
  DbContextFactory,
  PooledDbContextFactory
} from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';

// ── Fixtures ───────────────────────────────────────────────────────────────

@Entity({ name: 'pool_orders' })
class PoolOrder {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  description!: string;
}

class PoolOrderContext extends DbContext {
  orders = this.set(PoolOrder);
}

function makeOptions() {
  return { provider: new TestProvider(':memory:') };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DbContext Pooling & Factory — integration', () => {
  // ─── addDbContextFactory ───────────────────────────────────────────────

  describe('addDbContextFactory', () => {
    let factory: DbContextFactory<PoolOrderContext>;

    beforeEach(() => {
      factory = addDbContextFactory(PoolOrderContext, makeOptions());
    });

    it('produces a fresh context on every call', () => {
      const ctx1 = factory.createDbContext();
      const ctx2 = factory.createDbContext();
      expect(ctx1).not.toBe(ctx2);
    });

    it('contexts are fully isolated — no shared ChangeTracker', () => {
      const ctx1 = factory.createDbContext();
      const ctx2 = factory.createDbContext();

      ctx1.orders.add(Object.assign(new PoolOrder(), { id: 1, description: 'order-1' }));

      expect(ctx1.changeTracker.getChanges()).toHaveLength(1);
      expect(ctx2.changeTracker.getChanges()).toHaveLength(0);
    });

    it('createDbContextAsync resolves to an isolated context', async () => {
      const ctx = await factory.createDbContextAsync();
      expect(ctx).toBeInstanceOf(PoolOrderContext);
    });

    it('Symbol.asyncDispose disposes the context', async () => {
      const ctx = await factory.createDbContextAsync();
      const disconnectSpy = jest.spyOn(ctx['_provider'], 'disconnect');
      await ctx[Symbol.asyncDispose]();
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── addDbContextPool ─────────────────────────────────────────────────

  describe('addDbContextPool', () => {
    let factory: PooledDbContextFactory<PoolOrderContext>;

    beforeEach(() => {
      factory = addDbContextPool(PoolOrderContext, makeOptions(), { poolSize: 3 });
    });

    afterEach(async () => {
      await factory.dispose();
    });

    it('pool starts empty', () => {
      expect(factory.pool.size).toBe(0);
    });

    it('pool grows when contexts are returned', async () => {
      const ctx = await factory.createDbContextAsync();
      await ctx[Symbol.asyncDispose]();
      expect(factory.pool.size).toBe(1);
    });

    it('checkout re-uses the pooled instance (LIFO)', async () => {
      const ctx1 = await factory.createDbContextAsync();
      await ctx1[Symbol.asyncDispose]();

      const ctx2 = await factory.createDbContextAsync();
      expect(ctx2).toBe(ctx1);
    });

    it('no entity leak across sequential checkouts', async () => {
      for (let round = 0; round < 5; round++) {
        const ctx = await factory.createDbContextAsync();
        ctx.orders.add(Object.assign(new PoolOrder(), { id: round, description: `r${round}` }));
        expect(ctx.changeTracker.getChanges().length).toBeGreaterThan(0);
        await ctx[Symbol.asyncDispose]();

        const clean = await factory.createDbContextAsync();
        expect(clean.changeTracker.getChanges()).toHaveLength(0);
        await clean[Symbol.asyncDispose]();
      }
    });

    it('concurrent leases up to pool capacity do not interfere', async () => {
      const contexts = await Promise.all([
        factory.createDbContextAsync(),
        factory.createDbContextAsync(),
        factory.createDbContextAsync()
      ]);

      const uniqueRefs = new Set(contexts);
      expect(uniqueRefs.size).toBe(3);

      await Promise.all(contexts.map((c) => c[Symbol.asyncDispose]()));
      expect(factory.pool.size).toBe(3);
    });

    it('excess contexts are disposed when pool is full', async () => {
      const f2 = addDbContextPool(PoolOrderContext, makeOptions(), { poolSize: 1 });

      const ctx1 = await f2.createDbContextAsync();
      const ctx2 = await f2.createDbContextAsync();
      const disposeSpy = jest.spyOn(ctx2, 'dispose');

      await ctx1[Symbol.asyncDispose]();
      expect(f2.pool.size).toBe(1);

      await ctx2[Symbol.asyncDispose]();
      expect(f2.pool.size).toBe(1);
      expect(disposeSpy).toHaveBeenCalledTimes(1);

      await f2.dispose();
    });

    it('transaction depth is reset after return', async () => {
      const ctx = await factory.createDbContextAsync();
      // Drive the (nested) transaction depth through the public API, then verify
      // that returning the context to the pool resets it (observed via the public
      // `isInTransaction` surface rather than a private field).
      await ctx.beginTransaction();
      await ctx.beginTransaction();
      expect(ctx.isInTransaction).toBe(true);
      await ctx[Symbol.asyncDispose]();

      const recycled = await factory.createDbContextAsync();
      expect(recycled.isInTransaction).toBe(false);
    });
  });
});
