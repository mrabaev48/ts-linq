import 'reflect-metadata';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

import { DbContext } from '../src/DbContext';
import { DbContextPool, DEFAULT_POOL_SIZE } from '../src/pooling/DbContextPool';
import { TestProvider } from '../tests/stubs/TestProvider';

@Entity()
class PoolItem {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;
}

class PoolTestContext extends DbContext {
  items = this.set(PoolItem);
}

function makeContext(): PoolTestContext {
  return new PoolTestContext({ provider: new TestProvider(':memory:') });
}

describe('DbContextPool', () => {
  let pool: DbContextPool<PoolTestContext>;

  beforeEach(() => {
    pool = new DbContextPool<PoolTestContext>(4);
  });

  // ─── Construction ─────────────────────────────────────────────────────────

  describe('construction', () => {
    it('initialises with size 0', () => {
      expect(pool.size).toBe(0);
    });

    it('respects the provided maxSize', () => {
      expect(pool.maxSize).toBe(4);
    });

    it('uses DEFAULT_POOL_SIZE when no argument is given', () => {
      const defaultPool = new DbContextPool<PoolTestContext>();
      expect(defaultPool.maxSize).toBe(DEFAULT_POOL_SIZE);
    });

    it('throws RangeError for poolSize < 1', () => {
      expect(() => new DbContextPool(0)).toThrow(RangeError);
      expect(() => new DbContextPool(-1)).toThrow(RangeError);
    });
  });

  // ─── acquire ──────────────────────────────────────────────────────────────

  describe('acquire', () => {
    it('returns undefined when pool is empty', () => {
      expect(pool.acquire()).toBeUndefined();
    });

    it('returns the last released context (LIFO)', async () => {
      const ctx1 = makeContext();
      const ctx2 = makeContext();
      await pool.release(ctx1);
      await pool.release(ctx2);

      expect(pool.acquire()).toBe(ctx2);
      expect(pool.acquire()).toBe(ctx1);
    });

    it('decrements size on acquire', async () => {
      await pool.release(makeContext());
      pool.acquire();
      expect(pool.size).toBe(0);
    });
  });

  // ─── release ──────────────────────────────────────────────────────────────

  describe('release', () => {
    it('increments size when below capacity', async () => {
      await pool.release(makeContext());
      expect(pool.size).toBe(1);
    });

    it('does not exceed maxSize — disposes overflow context', async () => {
      const ctx1 = makeContext();
      const ctx2 = makeContext();
      const ctx3 = makeContext();
      const ctx4 = makeContext();
      const overflow = makeContext();
      const disposeSpy = jest.spyOn(overflow, 'dispose');

      await pool.release(ctx1);
      await pool.release(ctx2);
      await pool.release(ctx3);
      await pool.release(ctx4);
      expect(pool.size).toBe(4);

      await pool.release(overflow);
      expect(pool.size).toBe(4);
      expect(disposeSpy).toHaveBeenCalledTimes(1);
    });

    it('calls reset() on the context before pushing back', async () => {
      const ctx = makeContext();
      const resetSpy = jest.spyOn(ctx, 'reset');
      await pool.release(ctx);
      expect(resetSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── reset semantics ──────────────────────────────────────────────────────

  describe('reset semantics', () => {
    it('ChangeTracker is cleared after release', async () => {
      const ctx = makeContext();
      ctx.items.add(new PoolItem());
      expect(ctx.changeTracker.getChanges().length).toBeGreaterThan(0);

      await pool.release(ctx);
      const recycled = pool.acquire()!;
      expect(recycled.changeTracker.getChanges().length).toBe(0);
    });
  });

  // ─── dispose ──────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('disposes all idle contexts', async () => {
      const ctx1 = makeContext();
      const ctx2 = makeContext();
      const spy1 = jest.spyOn(ctx1, 'dispose');
      const spy2 = jest.spyOn(ctx2, 'dispose');

      await pool.release(ctx1);
      await pool.release(ctx2);
      await pool.dispose();

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(pool.size).toBe(0);
    });

    it('is safe to call on an empty pool', async () => {
      await expect(pool.dispose()).resolves.not.toThrow();
    });
  });
});
