import type { DbContextOptions } from '@ts-linq/core';

import type { DbContext } from '../DbContext';
import type { PoolOptions } from '../pooling/DbContextPool';
import { PooledDbContextFactory } from '../pooling/PooledDbContextFactory';
import { DbContextFactory } from './DbContextFactory';

export { DbContextFactory } from './DbContextFactory';
export { IDbContextFactory } from './IDbContextFactory';

/**
 * Create a simple (non-pooled) `DbContext` factory.
 *
 * The factory produces a brand-new `T` on every call to `createDbContext()` /
 * `createDbContextAsync()`. Each instance owns a separate database connection
 * that is torn down when the context is disposed.
 *
 * Mirrors EF Core's `services.AddDbContextFactory<T>(o => o.UseXxx(...))`.
 *
 * @param contextClass - Constructor of the concrete `DbContext` subclass.
 * @param options      - `DbContextOptions` (provider, interceptors, etc.)
 *                       passed to every new instance.
 * @returns A `DbContextFactory<T>` ready to hand out context instances.
 *
 * @example
 * ```ts
 * const factory = addDbContextFactory(AppContext, { provider });
 *
 * class Worker {
 *   constructor(private readonly factory: IDbContextFactory<AppContext>) {}
 *
 *   async doWork(): Promise<void> {
 *     await using const ctx = await this.factory.createDbContextAsync();
 *     // ...
 *   }
 * }
 * ```
 */
export function addDbContextFactory<T extends DbContext>(
  contextClass: new (opts: DbContextOptions) => T,
  options: DbContextOptions
): DbContextFactory<T> {
  return new DbContextFactory(contextClass, options);
}

/**
 * Create a pooled `DbContext` factory backed by a LIFO `DbContextPool`.
 *
 * Context instances are reset (ChangeTracker cleared, caches wiped,
 * transaction depth zeroed) before being returned to the pool, guaranteeing
 * that no entity state leaks between requests.
 *
 * Mirrors EF Core's `services.AddDbContextPool<T>(o => o.UseXxx(...), poolSize)`.
 *
 * @param contextClass - Constructor of the concrete `DbContext` subclass.
 * @param options      - `DbContextOptions` used when constructing new instances.
 * @param poolOptions  - Pool configuration; `poolSize` defaults to `128`.
 * @returns A `PooledDbContextFactory<T>` whose `createDbContextAsync()` leases
 *          instances from the internal pool and automatically returns them on
 *          `await using` / `Symbol.asyncDispose`.
 *
 * @example
 * ```ts
 * const factory = addDbContextPool(AppContext, { provider }, { poolSize: 32 });
 *
 * async function handleRequest(): Promise<void> {
 *   await using const ctx = await factory.createDbContextAsync();
 *   ctx.users.add(new User(...));
 *   await ctx.saveChanges();
 *   // ctx is returned to the pool here automatically
 * }
 * ```
 */
export function addDbContextPool<T extends DbContext>(
  contextClass: new (opts: DbContextOptions) => T,
  options: DbContextOptions,
  poolOptions?: PoolOptions
): PooledDbContextFactory<T> {
  return new PooledDbContextFactory(contextClass, options, poolOptions);
}
