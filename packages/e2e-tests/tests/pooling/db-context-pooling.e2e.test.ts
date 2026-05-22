import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { addDbContextFactory, addDbContextPool, DbContext } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

// ── Fixtures ───────────────────────────────────────────────────────────────

@Entity({ name: 'e2e_pool_products' })
class E2EPoolProduct {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;
}

class E2EPoolContext extends DbContext {
  products = this.set(E2EPoolProduct);
}

// ── Suite entry point ──────────────────────────────────────────────────────

const shouldRun = process.env.SKIP_DB_TESTS !== '1';

(shouldRun ? describe.each : describe.skip.each)(['postgresql', 'mysql', 'mssql'] as const)(
  'E2E DbContext Pooling — %s',
  (providerName) => {
    let provider: any;

    let harness: any;

    beforeEach(async () => {
      ({ harness, provider } = await setupTestDatabase(providerName));
    });

    afterEach(async () => {
      await dropTables(provider, ['e2e_pool_products']);
      await teardownTestDatabase(harness);
    });

    // ─── addDbContextFactory (non-pooled) ──────────────────────────────

    describe('addDbContextFactory', () => {
      it('creates a usable context per call — save and query', async () => {
        const factory = addDbContextFactory(E2EPoolContext, { provider });

        const ctx1 = await factory.createDbContextAsync();
        await ctx1.ensureCreated();
        ctx1.products.add(Object.assign(new E2EPoolProduct(), { name: 'widget-a' }));
        await ctx1.saveChanges();
        await ctx1[Symbol.asyncDispose]();

        const ctx2 = await factory.createDbContextAsync();
        const rows = await ctx2.products.toArray();
        expect(rows.length).toBeGreaterThanOrEqual(1);
        expect(rows.some((r) => r.name === 'widget-a')).toBe(true);
        await ctx2[Symbol.asyncDispose]();
      });

      it('each context has its own isolated ChangeTracker', async () => {
        const factory = addDbContextFactory(E2EPoolContext, { provider });

        const ctx1 = await factory.createDbContextAsync();
        await ctx1.ensureCreated();
        const ctx2 = await factory.createDbContextAsync();

        ctx1.products.add(Object.assign(new E2EPoolProduct(), { name: 'ctx1-product' }));

        expect(ctx1.changeTracker.getChanges().length).toBeGreaterThan(0);
        expect(ctx2.changeTracker.getChanges()).toHaveLength(0);

        await ctx1[Symbol.asyncDispose]();
        await ctx2[Symbol.asyncDispose]();
      });
    });

    // ─── addDbContextPool ─────────────────────────────────────────────

    describe('addDbContextPool', () => {
      it('save → return → re-acquire → no tracked entity leakage', async () => {
        const poolFactory = addDbContextPool(E2EPoolContext, { provider }, { poolSize: 4 });

        // Checkout #1: create schema and insert
        const ctx1 = await poolFactory.createDbContextAsync();
        await ctx1.ensureCreated();
        ctx1.products.add(Object.assign(new E2EPoolProduct(), { name: 'product-checkout-1' }));
        await ctx1.saveChanges();
        expect(ctx1.changeTracker.getChanges()).toHaveLength(0); // acceptAllChanges after save

        // Return to pool
        await ctx1[Symbol.asyncDispose]();
        expect(poolFactory.pool.size).toBe(1);

        // Checkout #2: re-acquire the same instance
        const ctx2 = await poolFactory.createDbContextAsync();
        expect(ctx2).toBe(ctx1); // same object
        expect(ctx2.changeTracker.getChanges()).toHaveLength(0); // no leak

        // Perform an independent query
        const rows = await ctx2.products.toArray();
        expect(rows.length).toBeGreaterThanOrEqual(1);

        await ctx2[Symbol.asyncDispose]();
        await poolFactory.dispose();
      });

      it('concurrent checkouts use different context instances', async () => {
        const poolFactory = addDbContextPool(E2EPoolContext, { provider }, { poolSize: 3 });

        const [c1, c2, c3] = await Promise.all([
          poolFactory.createDbContextAsync(),
          poolFactory.createDbContextAsync(),
          poolFactory.createDbContextAsync()
        ]);

        const unique = new Set([c1, c2, c3]);
        expect(unique.size).toBe(3);

        await c1.ensureCreated();
        await Promise.all([
          c1[Symbol.asyncDispose](),
          c2[Symbol.asyncDispose](),
          c3[Symbol.asyncDispose]()
        ]);

        expect(poolFactory.pool.size).toBe(3);
        await poolFactory.dispose();
      });
    });
  }
);
