import type { DbContext } from '../DbContext';

/** Default maximum number of idle contexts kept in the pool. */
export const DEFAULT_POOL_SIZE = 128;

/**
 * Configuration options for `DbContextPool`.
 */
export interface PoolOptions {
  /**
   * Maximum number of idle `DbContext` instances retained in the pool.
   *
   * When the pool is full and a context is returned, the excess context is
   * disposed instead of being recycled. Defaults to `128`.
   */
  poolSize?: number;
}

/**
 * A thread-safe LIFO (stack) pool of `DbContext` instances.
 *
 * Context instances are reset via `ctx.reset()` before being returned to the
 * pool, ensuring that no entity state or transaction artifacts leak between
 * checkouts.
 *
 * Architecture mirrors EF Core's internal `DbContextPool<T>` with a simpler
 * single-process model — no thread synchronisation primitives are required
 * because Node.js executes JavaScript on a single event-loop thread.
 *
 * @typeParam T - Concrete `DbContext` subclass managed by this pool.
 *
 * @example
 * ```ts
 * const pool = new DbContextPool<AppContext>(64);
 * let ctx = pool.acquire();
 * if (!ctx) ctx = new AppContext({ provider });
 * try {
 *   await ctx.saveChanges();
 * } finally {
 *   await pool.release(ctx);
 * }
 * ```
 */
export class DbContextPool<T extends DbContext> {
  private readonly _stack: T[] = [];
  private readonly _maxSize: number;

  /**
   * @param maxSize - Upper bound for idle instances. Defaults to `DEFAULT_POOL_SIZE`.
   */
  constructor(maxSize: number = DEFAULT_POOL_SIZE) {
    if (maxSize < 1) {
      throw new RangeError(`DbContextPool: poolSize must be ≥ 1, received ${maxSize}`);
    }
    this._maxSize = maxSize;
  }

  /**
   * Pop an idle context from the top of the LIFO stack.
   *
   * @returns An idle, already-reset `T`, or `undefined` when the pool is empty.
   */
  acquire(): T | undefined {
    return this._stack.pop();
  }

  /**
   * Return a context to the pool after use.
   *
   * If the pool has not reached capacity the context is reset and pushed back.
   * Otherwise the context is disposed and discarded.
   *
   * @param ctx - The context being returned.
   */
  async release(ctx: T): Promise<void> {
    if (this._stack.length < this._maxSize) {
      ctx.reset();
      this._stack.push(ctx);
    } else {
      await ctx.dispose();
    }
  }

  /**
   * Number of idle contexts currently in the pool.
   */
  get size(): number {
    return this._stack.length;
  }

  /**
   * Maximum number of idle contexts this pool will retain.
   */
  get maxSize(): number {
    return this._maxSize;
  }

  /**
   * Dispose all idle contexts in the pool and clear the stack.
   *
   * Should be called during application shutdown.
   */
  async dispose(): Promise<void> {
    const contexts = this._stack.splice(0);
    await Promise.all(contexts.map(async (ctx) => ctx.dispose()));
  }
}
