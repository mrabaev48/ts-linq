import { CapturedQueryPlan } from './compiled/CapturedQueryPlan';

/**
 * A compiled query function returned by EF.compileQuery / EF.compileAsyncQuery.
 * Callable like a regular function, but carries the underlying CapturedQueryPlan
 * for observability and SqlCache injection.
 */
export type CompiledQueryFn<TCtx, TParams extends unknown[], TResult> = ((
  ctx: TCtx,
  ...params: TParams
) => Promise<TResult>) & {
  /** The underlying plan — exposes planSqlCache, cacheHits, invocationCount. */
  readonly plan: CapturedQueryPlan<TCtx, TParams, TResult>;
};

/**
 * EF static namespace — mirrors the EF Core API surface for compiled queries.
 *
 * Usage:
 * ```ts
 * // Define once (e.g. as a static class property):
 * const getById = EF.compileQuery(
 *   (ctx: AppContext, id: number) =>
 *     ctx.users.whereIn('id', [id]).firstOrDefault()
 * );
 *
 * // Inject plan cache for optimal performance:
 * const ctx = new AppContext({
 *   provider,
 *   performance: { sqlCache: getById.plan.planSqlCache }
 * });
 *
 * // Execute (SQL template is cached after first call):
 * const user  = await getById(ctx, 1);
 * const user2 = await getById(ctx, 2); // SQL reused — cache hit
 * ```
 */
export class EF {
  /**
   * Compiles a parameterized query factory into a reusable plan.
   * Mirrors `EF.CompileQuery` from EF Core.
   *
   * The returned function caches the SQL template after its first invocation.
   * Inject `fn.plan.planSqlCache` into DbContext's performance options to
   * enable plan-level SQL caching across calls with different parameter values.
   *
   * @param factory A lambda `(ctx, ...params) => Promise<TResult>` that builds
   *   and executes a query. The factory may use any non-transformer query methods
   *   (whereIn, whereCompiled, etc.) that do not require the ts-patch plugin.
   */
  static compileQuery<TCtx, TParams extends unknown[], TResult>(
    factory: (ctx: TCtx, ...params: TParams) => Promise<TResult>
  ): CompiledQueryFn<TCtx, TParams, TResult> {
    const plan = new CapturedQueryPlan<TCtx, TParams, TResult>(factory);
    const fn = async (ctx: TCtx, ...params: TParams): Promise<TResult> =>
      plan.execute(ctx, ...params);
    Object.defineProperty(fn, 'plan', { value: plan, writable: false, enumerable: false });
    return fn as CompiledQueryFn<TCtx, TParams, TResult>;
  }

  /**
   * Compiles a parameterized async query factory into a reusable plan.
   * Mirrors `EF.CompileAsyncQuery` from EF Core.
   *
   * In ts-linq all queries are inherently async, so this is semantically
   * identical to compileQuery. Both methods are provided for API symmetry
   * with EF Core.
   *
   * @param factory A lambda `(ctx, ...params) => Promise<TResult>`.
   */
  static compileAsyncQuery<TCtx, TParams extends unknown[], TResult>(
    factory: (ctx: TCtx, ...params: TParams) => Promise<TResult>
  ): CompiledQueryFn<TCtx, TParams, TResult> {
    return EF.compileQuery(factory);
  }
}
