/**
 * Defines a mechanism for creating instances of a database context.
 *
 * Mirrors EF Core's `IDbContextFactory<TContext>` interface, enabling
 * short-lived context creation in long-lived hosts (background workers,
 * concurrent request processors, etc.).
 *
 * The factory pattern solves the lifetime-mismatch problem: the factory
 * itself can be a long-lived singleton while each `DbContext` instance
 * is explicitly scoped to a single unit-of-work.
 *
 * @typeParam T - The concrete `DbContext` subclass this factory produces.
 *
 * @example
 * ```ts
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
export interface IDbContextFactory<T> {
  /**
   * Create a new instance of `T`.
   *
   * The caller is responsible for calling `dispose()` on the returned
   * context when it is no longer needed.
   *
   * @returns A freshly constructed (or pool-leased) context instance.
   */
  createDbContext(): T;

  /**
   * Asynchronously create a new instance of `T`.
   *
   * Preferred over the synchronous overload in async code paths.
   * When using a pooled factory, the returned context will automatically
   * be returned to the pool when disposed via `await using`.
   *
   * @returns A promise resolving to a context ready for use.
   */
  createDbContextAsync(): Promise<T>;
}
