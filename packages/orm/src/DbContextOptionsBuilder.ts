import type { DbContextOptions } from '@ts-linq/core';
import { QuerySplittingBehavior } from '@ts-linq/types';

/**
 * Fluent builder for constructing DbContextOptions.
 * Mirrors EF Core's DbContextOptionsBuilder.
 *
 * Usage:
 *   const options = new DbContextOptionsBuilder(base)
 *     .addInterceptors(new MyCommandInterceptor(), new MyAuditInterceptor())
 *     .build();
 *   const ctx = new AppDbContext(options);
 */
export { QuerySplittingBehavior };

export class DbContextOptionsBuilder {
  private readonly _interceptors: object[] = [];
  private _splittingBehavior?: QuerySplittingBehavior;

  constructor(private readonly _base: DbContextOptions) {}

  /**
   * Register one or more interceptors. Registration order is preserved —
   * the pipeline iterates interceptors in declaration order, matching EF Core behaviour.
   *
   * A single object may implement multiple interceptor interfaces;
   * InterceptorRegistry will place it in every applicable partition.
   */
  addInterceptors(...interceptors: object[]): this {
    this._interceptors.push(...interceptors);
    return this;
  }

  /**
   * Set the global query-splitting strategy for all DbSet queries in this context.
   * Mirrors EF Core's `UseQuerySplittingBehavior(QuerySplittingBehavior)`.
   *
   * Can be overridden per-query with `.asSplitQuery()` / `.asSingleQuery()`.
   *
   * @example
   * const opts = new DbContextOptionsBuilder({ provider })
   *   .useQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
   *   .build();
   */
  useQuerySplittingBehavior(behavior: QuerySplittingBehavior): this {
    this._splittingBehavior = behavior;
    return this;
  }

  /**
   * Produce a DbContextOptions with all accumulated interceptors merged in.
   * Interceptors already present in the base options appear first, preserving
   * any prior registration order.
   */
  build(): DbContextOptions {
    return {
      ...this._base,
      interceptors: [...(this._base.interceptors ?? []), ...this._interceptors],
      ...(this._splittingBehavior !== undefined
        ? { querySplittingBehavior: this._splittingBehavior }
        : {})
    };
  }
}
