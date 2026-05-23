import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

import { DbContext } from '../src/DbContext';
import { addDbContextFactory } from '../src/factory';
import { DbContextFactory } from '../src/factory/DbContextFactory';
import { TestProvider } from '../tests/stubs/TestProvider';

@Entity()
class FactoryItem {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  value!: string;
}

class FactoryTestContext extends DbContext {
  items = this.set(FactoryItem);
}

function makeOptions() {
  return { provider: new TestProvider(':memory:') };
}

describe('DbContextFactory', () => {
  // ─── createDbContext ───────────────────────────────────────────────────────

  describe('createDbContext', () => {
    it('returns an instance of the provided context class', () => {
      const factory = new DbContextFactory(FactoryTestContext, makeOptions());
      const ctx = factory.createDbContext();
      expect(ctx).toBeInstanceOf(FactoryTestContext);
    });

    it('returns a different instance on each call', () => {
      const factory = new DbContextFactory(FactoryTestContext, makeOptions());
      const ctx1 = factory.createDbContext();
      const ctx2 = factory.createDbContext();
      expect(ctx1).not.toBe(ctx2);
    });

    it('each context has an isolated ChangeTracker', () => {
      const factory = new DbContextFactory(FactoryTestContext, makeOptions());
      const ctx1 = factory.createDbContext();
      const ctx2 = factory.createDbContext();

      ctx1.items.add(new FactoryItem());
      expect(ctx1.changeTracker.getChanges().length).toBeGreaterThan(0);
      expect(ctx2.changeTracker.getChanges().length).toBe(0);
    });
  });

  // ─── createDbContextAsync ─────────────────────────────────────────────────

  describe('createDbContextAsync', () => {
    it('resolves to an instance of the provided context class', async () => {
      const factory = new DbContextFactory(FactoryTestContext, makeOptions());
      const ctx = await factory.createDbContextAsync();
      expect(ctx).toBeInstanceOf(FactoryTestContext);
    });

    it('resolves to different instances on each call', async () => {
      const factory = new DbContextFactory(FactoryTestContext, makeOptions());
      const ctx1 = await factory.createDbContextAsync();
      const ctx2 = await factory.createDbContextAsync();
      expect(ctx1).not.toBe(ctx2);
    });
  });

  // ─── addDbContextFactory helper ───────────────────────────────────────────

  describe('addDbContextFactory', () => {
    it('returns a DbContextFactory instance', () => {
      const factory = addDbContextFactory(FactoryTestContext, makeOptions());
      expect(factory).toBeInstanceOf(DbContextFactory);
    });

    it('satisfies IDbContextFactory contract', async () => {
      const factory = addDbContextFactory(FactoryTestContext, makeOptions());
      expect(typeof factory.createDbContext).toBe('function');
      expect(typeof factory.createDbContextAsync).toBe('function');
    });
  });

  // ─── Symbol.asyncDispose (non-pooled path) ────────────────────────────────

  describe('Symbol.asyncDispose', () => {
    it('disposes the context normally when no pool hook is set', async () => {
      const factory = addDbContextFactory(FactoryTestContext, makeOptions());
      const ctx = await factory.createDbContextAsync();
      // Should not throw
      await expect(ctx[Symbol.asyncDispose]()).resolves.toBeUndefined();
    });
  });
});
