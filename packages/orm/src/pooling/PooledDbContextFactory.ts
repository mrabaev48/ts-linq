import type { DbContextOptions } from '@ts-linq/core';

import type { DbContext } from '../DbContext';
import type { IDbContextFactory } from '../factory/IDbContextFactory';
import type { PoolOptions } from './DbContextPool';
import { DbContextPool } from './DbContextPool';

/**
 * A `DbContext` factory that leases idle instances from an internal LIFO pool
 * rather than constructing a new one on every call.
 *
 * **Lifecycle:**
 * 1. `createDbContextAsync()` pops an idle instance from `DbContextPool`.
 * 2. If the pool is empty a fresh instance is constructed.
 * 3. A pool-return hook is attached to the leased context via
 *    `_setPoolReturnHook` so that `await using` (or an explicit
 *    `Symbol.asyncDispose` call) resets and returns the context to the pool
 *    instead of disconnecting.
 * 4. On pool-return the context is reset (`ChangeTracker.clear()`,
 *    `CacheCoordinator.clearAll()`, transaction depth → 0) before being
 *    pushed back onto the stack.
 *
 * Mirrors EF Core's `PooledDbContextFactory<T>` / `AddDbContextPool<T>`.
 *
 * @typeParam T - Concrete `DbContext` subclass managed by this factory.
 *
 * @example
 * ```ts
 * const factory = addDbContextPool(AppContext, { provider }, { poolSize: 32 });
 *
 * async function handleRequest() {
 *   await using const ctx = await factory.createDbContextAsync();
 *   ctx.users.add(new User(...));
 *   await ctx.saveChanges();
 *   // ctx is automatically returned to the pool here
 * }
 * ```
 */
export class PooledDbContextFactory<T extends DbContext> implements IDbContextFactory<T> {
  private readonly _contextClass: new (opts: DbContextOptions) => T;
  private readonly _options: DbContextOptions;
  private readonly _pool: DbContextPool<T>;

  /**
   * @param contextClass - Constructor of the concrete `DbContext` subclass.
   * @param options      - Options passed to newly constructed context instances.
   * @param poolOptions  - Optional pool configuration (e.g. `poolSize`).
   */
  constructor(
    contextClass: new (opts: DbContextOptions) => T,
    options: DbContextOptions,
    poolOptions?: PoolOptions
  ) {
    this._contextClass = contextClass;
    this._options = options;
    this._pool = new DbContextPool<T>(poolOptions?.poolSize);
  }

  /**
   * Synchronously lease a context from the pool or create a new one.
   *
   * **Note:** the returned context does **not** have a pool-return hook
   * attached when obtained via this synchronous overload. The caller is
   * responsible for calling `dispose()` or returning the context manually.
   * Prefer `createDbContextAsync()` for full pool integration.
   */
  createDbContext(): T {
    const pooled = this._pool.acquire();
    if (pooled) return pooled;
    return new this._contextClass(this._options);
  }

  /**
   * Asynchronously lease a context from the pool or create a new one.
   *
   * Attaches a pool-return hook so that `await using` automatically resets
   * and recycles the context when the `await using` block exits.
   */
  async createDbContextAsync(): Promise<T> {
    let ctx = this._pool.acquire();
    if (!ctx) {
      ctx = new this._contextClass(this._options);
    }
    const pool = this._pool;
    ctx._setPoolReturnHook(async () => {
      await pool.release(ctx!);
    });
    return ctx;
  }

  /**
   * Expose the underlying pool for monitoring (e.g. `pool.size`).
   */
  get pool(): DbContextPool<T> {
    return this._pool;
  }

  /**
   * Dispose all idle contexts currently held in the pool.
   *
   * Call during application shutdown to cleanly close lingering connections.
   */
  async dispose(): Promise<void> {
    await this._pool.dispose();
  }
}
