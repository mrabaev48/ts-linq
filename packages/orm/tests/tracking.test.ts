import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { QueryTrackingBehavior } from '@ts-linq/core';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { EntityState } from '@ts-linq/types';

import { ChangeTracker } from '../src/ChangeTracker';
import { DbContext } from '../src/DbContext';
import { TestProvider } from './stubs/TestProvider';

// ─── Fixtures ────────────────────────────────────────────────────────────────

@Entity()
class TrackUser {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;
}

class TrackUserContext extends DbContext {
  users = this.defineSet(TrackUser);
  get tracker(): ChangeTracker {
    return this.changeTracker;
  }
}

// ─── QueryTrackingBehavior enum ───────────────────────────────────────────────

describe('QueryTrackingBehavior enum', () => {
  it('exports all three values', () => {
    expect(QueryTrackingBehavior.TrackAll).toBe('TrackAll');
    expect(QueryTrackingBehavior.NoTracking).toBe('NoTracking');
    expect(QueryTrackingBehavior.NoTrackingWithIdentityResolution).toBe(
      'NoTrackingWithIdentityResolution'
    );
  });
});

// ─── ChangeTracker.queryTrackingBehavior ─────────────────────────────────────

describe('ChangeTracker.queryTrackingBehavior', () => {
  it('defaults to TrackAll', () => {
    const ct = new ChangeTracker();
    expect(ct.queryTrackingBehavior).toBe(QueryTrackingBehavior.TrackAll);
  });

  it('can be set to NoTracking', () => {
    const ct = new ChangeTracker();
    ct.queryTrackingBehavior = QueryTrackingBehavior.NoTracking;
    expect(ct.queryTrackingBehavior).toBe(QueryTrackingBehavior.NoTracking);
  });

  it('can be set to NoTrackingWithIdentityResolution', () => {
    const ct = new ChangeTracker();
    ct.queryTrackingBehavior = QueryTrackingBehavior.NoTrackingWithIdentityResolution;
    expect(ct.queryTrackingBehavior).toBe(QueryTrackingBehavior.NoTrackingWithIdentityResolution);
  });

  it('implements EntityAttacher.attach', () => {
    const ct = new ChangeTracker();
    const entity = Object.assign(new TrackUser(), { id: 1, name: 'Test' });
    ct.attach(entity, TrackUser);
    expect(ct.getEntityState(entity)).toBe(EntityState.Unchanged);
  });
});

// ─── Tracked vs untracked materialization ────────────────────────────────────

describe('Queryable tracking modes', () => {
  let ctx: TrackUserContext;
  let provider: TestProvider;

  beforeEach(async () => {
    provider = new TestProvider(':memory:');
    await provider.connect();
    ctx = new TrackUserContext({ provider });
    await ctx.ensureCreated();

    // Seed two rows via context
    await ctx.users.add(Object.assign(new TrackUser(), { name: 'Alice' }));
    await ctx.users.add(Object.assign(new TrackUser(), { name: 'Bob' }));
    await ctx.saveChanges();
    // Clear tracker state so we can observe what the query attaches
    ctx.tracker.clear();
  });

  afterEach(async () => {
    await ctx.dispose();
    await provider.disconnect();
  });

  it('TrackAll (default): toArray() attaches entities as Unchanged', async () => {
    const users = await ctx.users.toArray();
    expect(users.length).toBe(2);
    for (const u of users) {
      expect(ctx.tracker.getEntityState(u)).toBe(EntityState.Unchanged);
    }
  });

  it('asNoTracking(): toArray() does NOT attach entities to ChangeTracker', async () => {
    const users = await ctx.users.asNoTracking().toArray();
    expect(users.length).toBe(2);
    // getChanges() returns only entities in the tracker
    expect(ctx.tracker.getChanges().length).toBe(0);
  });

  it('asNoTracking() chained with take() returns correct results without tracking', async () => {
    const users = await ctx.users.asNoTracking().take(1).toArray();
    expect(users.length).toBe(1);
    expect(ctx.tracker.getChanges().length).toBe(0);
  });

  it('asTracking() explicitly enables tracking', async () => {
    const users = await ctx.users.asTracking().toArray();
    expect(users.length).toBe(2);
    for (const u of users) {
      expect(ctx.tracker.getEntityState(u)).toBe(EntityState.Unchanged);
    }
  });

  it('asNoTrackingWithIdentityResolution(): deduplicates by PK without tracking', async () => {
    const users = await ctx.users.asNoTrackingWithIdentityResolution().toArray();
    expect(users.length).toBe(2);
    // Not tracked
    expect(ctx.tracker.getChanges().length).toBe(0);
  });

  it('asNoTrackingWithIdentityResolution(): duplicate PKs return same object reference', async () => {
    // Insert a second row with the same id (simulating a JOIN result with duplicates)
    const dup1 = Object.assign(new TrackUser(), { id: 1, name: 'Alice' });
    const dup2 = Object.assign(new TrackUser(), { id: 1, name: 'Alice copy' });
    // Manually add duplicates to provider data via direct insert
    await provider.insert(dup1, TrackUser);
    await provider.insert(dup2, TrackUser);

    const users = await ctx.users.asNoTrackingWithIdentityResolution().toArray();
    // All rows with id=1 should resolve to the same object
    const id1Rows = users.filter((u) => u.id === 1);
    if (id1Rows.length > 1) {
      // Every duplicate should be the same reference as the first seen
      for (let i = 1; i < id1Rows.length; i++) {
        expect(id1Rows[i]).toBe(id1Rows[0]);
      }
    }
  });

  it('context-level NoTracking via queryTrackingBehavior overrides default', async () => {
    ctx.tracker.queryTrackingBehavior = QueryTrackingBehavior.NoTracking;
    await ctx.users.toArray();
    expect(ctx.tracker.getChanges().length).toBe(0);
  });

  it('per-query asNoTracking() overrides context-level TrackAll', async () => {
    // Default is TrackAll, per-query override should win
    const users = await ctx.users.asNoTracking().toArray();
    expect(users.length).toBeGreaterThan(0);
    expect(ctx.tracker.getChanges().length).toBe(0);
  });
});

// ─── first() / firstOrDefault() tracking ─────────────────────────────────────

describe('first() / firstOrDefault() with tracking', () => {
  let ctx: TrackUserContext;
  let provider: TestProvider;

  beforeEach(async () => {
    provider = new TestProvider(':memory:');
    await provider.connect();
    ctx = new TrackUserContext({ provider });
    await ctx.ensureCreated();
    await ctx.users.add(Object.assign(new TrackUser(), { name: 'Alice' }));
    await ctx.saveChanges();
    ctx.tracker.clear();
  });

  afterEach(async () => {
    await ctx.dispose();
    await provider.disconnect();
  });

  it('TrackAll: first() attaches the result entity', async () => {
    const user = await ctx.users.first();
    expect(ctx.tracker.getEntityState(user)).toBe(EntityState.Unchanged);
  });

  it('NoTracking: first() does not attach the result entity', async () => {
    const user = await ctx.users.asNoTracking().first();
    expect(user.name).toBe('Alice');
    expect(ctx.tracker.getChanges().length).toBe(0);
  });

  it('TrackAll: firstOrDefault() attaches when found', async () => {
    const user = await ctx.users.firstOrDefault();
    expect(user).not.toBeNull();
    if (user) expect(ctx.tracker.getEntityState(user)).toBe(EntityState.Unchanged);
  });

  it('NoTracking: firstOrDefault() does not attach', async () => {
    const user = await ctx.users.asNoTracking().firstOrDefault();
    expect(user?.name).toBe('Alice');
    expect(ctx.tracker.getChanges().length).toBe(0);
  });
});
