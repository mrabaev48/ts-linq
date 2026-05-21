/**
 * Integration tests — Compiled Queries (P1-20).
 *
 * Verifies:
 * - EF.compileQuery with plan.planSqlCache injected as DbContext's sqlCache
 * - plan.invocationCount increments on every call
 * - plan.isWarm becomes true after first cache hit
 * - cacheHits increments on second call with different params (same SQL structure)
 * - compileAsyncQuery is symmetric
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext, DbContextOptionsBuilder } from '@ts-linq/orm';
import { EF } from '@ts-linq/query';
import { TestProvider } from '@ts-linq/testkits';
import type { SqlCache } from '@ts-linq/types';

// ── Entity fixtures ───────────────────────────────────────────────────────────

@Entity({ name: 'cq_users' })
class CqUser {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'INTEGER' })
  age!: number;
}

// ── Context ───────────────────────────────────────────────────────────────────

class CqContext extends DbContext {
  users = this.defineSet(CqUser);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(sqlCache?: SqlCache): CqContext {
  const provider = new TestProvider(':memory:');
  const options = sqlCache ? { provider, performance: { sqlCache } } : { provider };
  return new CqContext(new DbContextOptionsBuilder(options).build());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EF.compileQuery — invocationCount (P1-20)', () => {
  let ctx: CqContext;

  afterEach(async () => {
    if (ctx) await ctx.dispose();
  });

  it('increments invocationCount on each call', async () => {
    const getAllUsers = EF.compileQuery(async (c: CqContext) => c.users.toArray());
    ctx = makeCtx(getAllUsers.plan.planSqlCache);
    await ctx.ensureCreated();

    await getAllUsers(ctx);
    await getAllUsers(ctx);
    await getAllUsers(ctx);
    expect(getAllUsers.plan.invocationCount).toBe(3);
  });

  it('isWarm starts false and becomes true after cache hit', async () => {
    const getAllUsers = EF.compileQuery(async (c: CqContext) => c.users.toArray());
    ctx = makeCtx(getAllUsers.plan.planSqlCache);
    await ctx.ensureCreated();

    expect(getAllUsers.plan.isWarm).toBe(false);
    await getAllUsers(ctx); // first call — cache miss, template stored
    await getAllUsers(ctx); // second call — cache hit
    expect(getAllUsers.plan.isWarm).toBe(true);
  });

  it('cacheHits increments after first template reuse', async () => {
    const getAllUsers = EF.compileQuery(async (c: CqContext) => c.users.toArray());
    ctx = makeCtx(getAllUsers.plan.planSqlCache);
    await ctx.ensureCreated();

    expect(getAllUsers.plan.cacheHits).toBe(0);
    await getAllUsers(ctx); // miss
    await getAllUsers(ctx); // hit
    expect(getAllUsers.plan.cacheHits).toBeGreaterThanOrEqual(1);
  });
});

describe('EF.compileQuery — plan cache with whereIn (P1-20)', () => {
  let ctx: CqContext;

  beforeEach(async () => {
    ctx = makeCtx();
    await ctx.ensureCreated();
    ctx.set(CqUser).add(Object.assign(new CqUser(), { id: 1, name: 'Alice', age: 30 }));
    ctx.set(CqUser).add(Object.assign(new CqUser(), { id: 2, name: 'Bob', age: 25 }));
    await ctx.saveChanges();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('whereIn query invocationCount increments correctly', async () => {
    const getById = EF.compileQuery(async (c: CqContext, id: number) =>
      c.users.whereIn('id', [id]).toArray()
    );
    const localCtx = makeCtx(getById.plan.planSqlCache);
    await localCtx.ensureCreated();
    localCtx.set(CqUser).add(Object.assign(new CqUser(), { id: 1, name: 'Alice', age: 30 }));
    await localCtx.saveChanges();

    await getById(localCtx, 1);
    await getById(localCtx, 2);
    expect(getById.plan.invocationCount).toBe(2);
    await localCtx.dispose();
  });

  it('second whereIn call with different id hits plan cache', async () => {
    const getById = EF.compileQuery(async (c: CqContext, id: number) =>
      c.users.whereIn('id', [id]).toArray()
    );
    const localCtx = makeCtx(getById.plan.planSqlCache);
    await localCtx.ensureCreated();
    localCtx.set(CqUser).add(Object.assign(new CqUser(), { id: 1, name: 'Alice', age: 30 }));
    await localCtx.saveChanges();

    await getById(localCtx, 1); // miss — template stored
    const hitsBefore = getById.plan.cacheHits;
    await getById(localCtx, 2); // hit — same SQL structure, different param
    expect(getById.plan.cacheHits).toBeGreaterThan(hitsBefore);
    await localCtx.dispose();
  });
});

describe('EF.compileAsyncQuery — symmetric with compileQuery (P1-20)', () => {
  let ctx: CqContext;

  afterEach(async () => {
    if (ctx) await ctx.dispose();
  });

  it('compileAsyncQuery invocationCount and isWarm work identically', async () => {
    const getAllAsync = EF.compileAsyncQuery(async (c: CqContext) => c.users.toArray());
    ctx = makeCtx(getAllAsync.plan.planSqlCache);
    await ctx.ensureCreated();

    await getAllAsync(ctx);
    await getAllAsync(ctx);
    expect(getAllAsync.plan.invocationCount).toBe(2);
    expect(getAllAsync.plan.isWarm).toBe(true);
  });
});
