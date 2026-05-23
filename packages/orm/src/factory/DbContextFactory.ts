import type { DbContextOptions } from '@ts-linq/core';

import type { DbContext } from '../DbContext';
import type { IDbContextFactory } from './IDbContextFactory';

/**
 * A stateless factory that creates a new `DbContext` instance on every call.
 *
 * Use this variant when you need explicit lifetime control and can afford a
 * fresh database connection per unit-of-work (e.g. background jobs that run
 * infrequently). For high-throughput scenarios prefer `PooledDbContextFactory`.
 *
 * Mirrors EF Core's `IDbContextFactory<T>` registration without pooling
 * (`services.AddDbContextFactory<T>(...)`).
 *
 * @typeParam T - Concrete `DbContext` subclass produced by this factory.
 *
 * @example
 * ```ts
 * const factory = addDbContextFactory(AppContext, { provider });
 *
 * async function doWork() {
 *   await using const ctx = await factory.createDbContextAsync();
 *   // ctx is a brand-new AppContext; dispose() is called automatically
 * }
 * ```
 */
export class DbContextFactory<T extends DbContext> implements IDbContextFactory<T> {
  private readonly _contextClass: new (opts: DbContextOptions) => T;
  private readonly _options: DbContextOptions;

  /**
   * @param contextClass - Constructor of the concrete `DbContext` subclass.
   * @param options      - Options passed verbatim to each new context instance.
   */
  constructor(contextClass: new (opts: DbContextOptions) => T, options: DbContextOptions) {
    this._contextClass = contextClass;
    this._options = options;
  }

  /**
   * Synchronously create a new context instance.
   *
   * The caller must dispose the returned context when finished.
   */
  createDbContext(): T {
    return new this._contextClass(this._options);
  }

  /**
   * Asynchronously create a new context instance.
   *
   * Returns a Promise for API symmetry with `PooledDbContextFactory` and to
   * support `await using` syntax out-of-the-box.
   */
  async createDbContextAsync(): Promise<T> {
    return this.createDbContext();
  }
}
