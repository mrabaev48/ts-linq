import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

import { DbContext } from '../src/DbContext';
import { addDbContextPool } from '../src/factory';
import { PooledDbContextFactory } from '../src/pooling/PooledDbContextFactory';
import { TestProvider } from '../tests/stubs/TestProvider';

@Entity()
class PooledItem {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  label!: string;
}

class PooledTestContext extends DbContext {
  items = this.set(PooledItem);
}

function makeOptions() {
  return { provider: new TestProvider(':memory:') };
}

describe('PooledDbContextFactory', () => {
  let factory: PooledDbContextFactory<PooledTestContext>;

  beforeEach(() => {
    factory = new PooledDbContextFactory(PooledTestContext, makeOptions(), { poolSize: 4 });
  });

  afterEach(async () => {
    await factory.dispose();
  });

  // ─── createDbContext (sync) ────────────────────────────────────────────────

  describe('createDbContext (sync)', () => {
    it('returns an instance of the context class', () => {
      const ctx = factory.createDbContext();
      expect(ctx).toBeInstanceOf(PooledTestContext);
    });

    it('creates a new instance when pool is empty', () => {
      const ctx = factory.createDbContext();
      expect(ctx).toBeDefined();
    });
  });

  // ─── createDbContextAsync ─────────────────────────────────────────────────

  describe('createDbContextAsync', () => {
    it('resolves to an instance of the context class', async () => {
      const ctx = await factory.createDbContextAsync();
      expect(ctx).toBeInstanceOf(PooledTestContext);
    });

    it('creates a new instance when pool is empty', async () => {
      expect(factory.pool.size).toBe(0);
      const ctx = await factory.createDbContextAsync();
      expect(ctx).toBeInstanceOf(PooledTestContext);
    });

    it('leases a context from the pool when one is available', async () => {
      const ctx = await factory.createDbContextAsync();
      // Return via Symbol.asyncDispose (pool-return hook)
      await ctx[Symbol.asyncDispose]();
      expect(factory.pool.size).toBe(1);

      const ctx2 = await factory.createDbContextAsync();
      expect(factory.pool.size).toBe(0);
      expect(ctx2).toBe(ctx);
    });
  });

  // ─── pool-return hook (Symbol.asyncDispose) ───────────────────────────────

  describe('Symbol.asyncDispose (pooled path)', () => {
    it('returns the context to the pool instead of disconnecting', async () => {
      const ctx = await factory.createDbContextAsync();
      const disconnectSpy = jest.spyOn(ctx['_provider'], 'disconnect');

      await ctx[Symbol.asyncDispose]();

      expect(factory.pool.size).toBe(1);
      expect(disconnectSpy).not.toHaveBeenCalled();
    });

    it('resets ChangeTracker before returning to pool', async () => {
      const ctx = await factory.createDbContextAsync();
      ctx.items.add(new PooledItem());
      expect(ctx.changeTracker.getChanges().length).toBeGreaterThan(0);

      await ctx[Symbol.asyncDispose]();

      const recycled = await factory.createDbContextAsync();
      expect(recycled.changeTracker.getChanges().length).toBe(0);
    });
  });

  // ─── entity leak prevention ───────────────────────────────────────────────

  describe('entity leak prevention', () => {
    it('does not leak tracked entities across checkouts', async () => {
      // First checkout: add an entity
      const ctx1 = await factory.createDbContextAsync();
      ctx1.items.add(Object.assign(new PooledItem(), { id: 1, label: 'leaked?' }));
      expect(ctx1.changeTracker.getChanges().length).toBe(1);

      // Return to pool — reset must clear tracking
      await ctx1[Symbol.asyncDispose]();

      // Second checkout: pool should give us the same instance, clean
      const ctx2 = await factory.createDbContextAsync();
      expect(ctx2.changeTracker.getChanges().length).toBe(0);
    });

    it('stress: 10 sequential checkouts — no entity accumulation', async () => {
      for (let i = 0; i < 10; i++) {
        const ctx = await factory.createDbContextAsync();
        ctx.items.add(Object.assign(new PooledItem(), { id: i, label: `item-${i}` }));
        await ctx[Symbol.asyncDispose]();

        const verification = await factory.createDbContextAsync();
        expect(verification.changeTracker.getChanges().length).toBe(0);
        await verification[Symbol.asyncDispose]();
      }
    });
  });

  // ─── pool exposure ────────────────────────────────────────────────────────

  describe('pool property', () => {
    it('exposes the underlying DbContextPool', () => {
      expect(factory.pool).toBeDefined();
      expect(typeof factory.pool.size).toBe('number');
    });
  });

  // ─── addDbContextPool helper ──────────────────────────────────────────────

  describe('addDbContextPool', () => {
    it('returns a PooledDbContextFactory instance', () => {
      const f = addDbContextPool(PooledTestContext, makeOptions(), { poolSize: 8 });
      expect(f).toBeInstanceOf(PooledDbContextFactory);
    });

    it('uses default pool size when poolOptions is omitted', () => {
      const f = addDbContextPool(PooledTestContext, makeOptions());
      expect(f.pool.maxSize).toBe(128);
    });

    it('respects provided poolSize', () => {
      const f = addDbContextPool(PooledTestContext, makeOptions(), { poolSize: 16 });
      expect(f.pool.maxSize).toBe(16);
    });
  });
});
