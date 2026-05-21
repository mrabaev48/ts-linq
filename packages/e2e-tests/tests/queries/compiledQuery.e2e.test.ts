/**
 * E2E tests — Compiled Queries (P1-20).
 *
 * Skipped when SKIP_DB_TESTS=1 (CI environments without a real DB).
 *
 * Verifies against real database providers:
 * - EF.compileQuery executes correctly with a real DbContext
 * - plan.invocationCount increments on each call
 * - plan.isWarm becomes true after first cache hit
 * - plan.cacheHits increments on repeated calls with the same SQL structure
 */
import 'reflect-metadata';

import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';
import { EF } from '@ts-linq/query';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

@Entity({ name: 'cq_e2e_users' })
class CqE2EUser {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'number', name: 'age' })
  age!: number;
}

class CqE2EContext extends DbContext {
  users = this.defineSet(CqE2EUser);
}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))(
  'E2E Compiled Queries (P1-20) - %s',
  (providerName) => {
    let harness: any;
    let provider: any;
    let context: CqE2EContext;

    beforeAll(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      ({ harness, provider } = await setupTestDatabase(providerName as any));
      context = new CqE2EContext({ provider });
      await context.ensureCreated();

      const u1 = new CqE2EUser();
      u1.name = 'Alice';
      u1.age = 30;
      context.set(CqE2EUser).add(u1);

      const u2 = new CqE2EUser();
      u2.name = 'Bob';
      u2.age = 25;
      context.set(CqE2EUser).add(u2);

      await context.saveChanges();
    });

    afterAll(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;
      await dropTables(provider, ['cq_e2e_users']);
      await context.dispose();
      await teardownTestDatabase(harness);
    });

    it('invocationCount increments on every compiled query call', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const getAllUsers = EF.compileQuery(async (ctx: CqE2EContext) => ctx.users.toArray());
      const localCtx = new CqE2EContext({
        provider,
        performance: { sqlCache: getAllUsers.plan.planSqlCache }
      });

      await getAllUsers(localCtx);
      await getAllUsers(localCtx);
      expect(getAllUsers.plan.invocationCount).toBe(2);
      await localCtx.dispose();
    });

    it('isWarm becomes true after first plan cache hit', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const getAllUsers = EF.compileQuery(async (ctx: CqE2EContext) => ctx.users.toArray());
      const localCtx = new CqE2EContext({
        provider,
        performance: { sqlCache: getAllUsers.plan.planSqlCache }
      });

      expect(getAllUsers.plan.isWarm).toBe(false);
      await getAllUsers(localCtx); // miss — template stored
      await getAllUsers(localCtx); // hit
      expect(getAllUsers.plan.isWarm).toBe(true);
      await localCtx.dispose();
    });

    it('cacheHits increments after plan template is reused', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const getAllUsers = EF.compileQuery(async (ctx: CqE2EContext) => ctx.users.toArray());
      const localCtx = new CqE2EContext({
        provider,
        performance: { sqlCache: getAllUsers.plan.planSqlCache }
      });

      await getAllUsers(localCtx); // miss
      const hitsBefore = getAllUsers.plan.cacheHits;
      await getAllUsers(localCtx); // hit
      expect(getAllUsers.plan.cacheHits).toBeGreaterThan(hitsBefore);
      await localCtx.dispose();
    });

    it('compileAsyncQuery works identically to compileQuery', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const getAllAsync = EF.compileAsyncQuery(async (ctx: CqE2EContext) => ctx.users.toArray());
      const localCtx = new CqE2EContext({
        provider,
        performance: { sqlCache: getAllAsync.plan.planSqlCache }
      });

      await getAllAsync(localCtx);
      await getAllAsync(localCtx);
      expect(getAllAsync.plan.invocationCount).toBe(2);
      expect(getAllAsync.plan.isWarm).toBe(true);
      await localCtx.dispose();
    });
  }
);
