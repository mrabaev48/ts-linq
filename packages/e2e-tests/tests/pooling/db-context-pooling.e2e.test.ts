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
    //
    // NOTE: Multiple DbContextFactory contexts share the same `provider`
    // instance (a DB connection pool).  Calling `dispose()` / [Symbol.asyncDispose]
    // on any one of them would end the underlying DB pool and break the others.
    // Therefore, in e2e tests we do NOT dispose intermediate factory contexts
    // during the test body; `teardownTestDatabase` in `afterEach` owns cleanup.

    describe('addDbContextFactory', () => {
      it('creates a usable context — save and re-query in the same context', async () => {
        const factory = addDbContextFactory(E2EPoolContext, { provider });

        const ctx = factory.createDbContext();
        await ctx.ensureCreated();
        ctx.products.add(Object.assign(new E2EPoolProduct(), { name: 'widget-a' }));
        await ctx.saveChanges();

        const rows = await ctx.products.toArray();
        expect(rows.length).toBeGreaterThanOrEqual(1);
        expect(rows.some((r) => r.name === 'widget-a')).toBe(true);
        // Intentionally NOT disposing here — shared provider is owned by afterEach cleanup.
      });

      it('each context has its own isolated ChangeTracker', async () => {
        const factory = addDbContextFactory(E2EPoolContext, { provider });

        const ctx1 = factory.createDbContext();
        // ensureCreated connects the provider (autoConnect: false in setupTestDatabase)
        // so that afterEach dropTables can execute successfully.
        await ctx1.ensureCreated();
        const ctx2 = factory.createDbContext();

        ctx1.products.add(Object.assign(new E2EPoolProduct(), { name: 'ctx1-product' }));

        expect(ctx1.changeTracker.getChanges()).toHaveLength(1);
        expect(ctx2.changeTracker.getChanges()).toHaveLength(0);
        // Not disposing — shared provider must stay connected for afterEach cleanup.
      });

      it('factory produces distinct context instances', async () => {
        const factory = addDbContextFactory(E2EPoolContext, { provider });

        const ctx1 = factory.createDbContext();
        // Connect the provider so afterEach dropTables does not fail.
        await ctx1.ensureCreated();
        const ctx2 = factory.createDbContext();

        expect(ctx1).not.toBe(ctx2);
        expect(ctx1).toBeInstanceOf(E2EPoolContext);
        expect(ctx2).toBeInstanceOf(E2EPoolContext);
      });
    });

    // ─── addDbContextPool ─────────────────────────────────────────────
    //
    // NOTE: `pool.dispose()` calls `ctx.dispose()` on every idle context,
    // each of which would call `provider.disconnect()` on the same shared
    // provider — causing "end on pool more than once" errors.
    // We therefore do NOT call `pool.dispose()` in the test body.
    // Returning a context via [Symbol.asyncDispose] is safe: it resets state
    // and pushes the context back to the pool WITHOUT disconnecting.

    describe('addDbContextPool', () => {
      it('save → return → re-acquire → no tracked entity leakage', async () => {
        const poolFactory = addDbContextPool(E2EPoolContext, { provider }, { poolSize: 4 });

        // Checkout #1: create schema and insert a row
        const ctx1 = await poolFactory.createDbContextAsync();
        await ctx1.ensureCreated();
        ctx1.products.add(Object.assign(new E2EPoolProduct(), { name: 'product-checkout-1' }));
        await ctx1.saveChanges();
        expect(ctx1.changeTracker.getChanges()).toHaveLength(0); // acceptAllChanges after save

        // Return to pool — resets ChangeTracker, does NOT disconnect provider
        await ctx1[Symbol.asyncDispose]();
        expect(poolFactory.pool.size).toBe(1);

        // Checkout #2: must re-use the same instance (LIFO)
        const ctx2 = await poolFactory.createDbContextAsync();
        expect(ctx2).toBe(ctx1); // same object recycled
        expect(ctx2.changeTracker.getChanges()).toHaveLength(0); // no entity leak

        // Provider is still connected — query works
        const rows = await ctx2.products.toArray();
        expect(rows.length).toBeGreaterThanOrEqual(1);

        // Return ctx2 to pool (no disconnect)
        await ctx2[Symbol.asyncDispose]();
        // Do NOT call pool.dispose() — would disconnect the shared provider.
        // afterEach → teardownTestDatabase handles the real cleanup.
      });

      it('concurrent checkouts yield distinct context instances', async () => {
        const poolFactory = addDbContextPool(E2EPoolContext, { provider }, { poolSize: 3 });

        // Check out 3 contexts simultaneously — pool is empty so each is newly created
        const [c1, c2, c3] = await Promise.all([
          poolFactory.createDbContextAsync(),
          poolFactory.createDbContextAsync(),
          poolFactory.createDbContextAsync()
        ]);

        const unique = new Set([c1, c2, c3]);
        expect(unique.size).toBe(3); // all distinct

        await c1.ensureCreated();

        // Return all to pool (resets state, does NOT disconnect)
        await Promise.all([
          c1[Symbol.asyncDispose](),
          c2[Symbol.asyncDispose](),
          c3[Symbol.asyncDispose]()
        ]);

        expect(poolFactory.pool.size).toBe(3);
        // Do NOT call pool.dispose() — shared provider cleanup is owned by afterEach.
      });

      it('pool-return resets ChangeTracker — no entity leakage across rounds', async () => {
        const poolFactory = addDbContextPool(E2EPoolContext, { provider }, { poolSize: 2 });

        await (await poolFactory.createDbContextAsync()).ensureCreated();
        // (above ctx is orphaned — pool will GC it; we only need ensureCreated once)

        // Fresh checkout for the real test
        const lease1 = await poolFactory.createDbContextAsync();
        lease1.products.add(Object.assign(new E2EPoolProduct(), { name: 'should-not-leak' }));
        expect(lease1.changeTracker.getChanges()).toHaveLength(1);

        // Return WITHOUT saving — ChangeTracker must be cleared on return
        await lease1[Symbol.asyncDispose]();

        const lease2 = await poolFactory.createDbContextAsync();
        expect(lease2.changeTracker.getChanges()).toHaveLength(0);

        await lease2[Symbol.asyncDispose]();
      });
    });
  }
);
