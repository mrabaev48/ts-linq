import type { DbContextOptions } from '@ts-linq/core';
import type { ExecutionStrategyOptions } from '@ts-linq/types';
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

/** Options for configuring the migrations integration on `DbContextOptionsBuilder`. */
export interface MigrationsOptions {
  /**
   * Absolute or relative path to the directory containing migration files.
   * Used by `ctx.database.hasPendingModelChanges()`, `getPendingMigrations()`,
   * and `migrate()`.
   */
  directory: string;
}

export class DbContextOptionsBuilder {
  private readonly _interceptors: object[] = [];
  private _splittingBehavior?: QuerySplittingBehavior;
  private _executionStrategyOptions?: ExecutionStrategyOptions;
  private _spatialEnabled = false;
  private _migrationsDirectory?: string;

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
   * Configure automatic retry on transient failures for this context.
   * Mirrors EF Core's provider-level `EnableRetryOnFailure` extension.
   *
   * The configured strategy is used by `context.database.createExecutionStrategy()`.
   *
   * @example
   * const opts = new DbContextOptionsBuilder({ provider })
   *   .enableRetryOnFailure({ maxRetryCount: 5, maxRetryDelay: 30_000 })
   *   .build();
   */
  enableRetryOnFailure(options: ExecutionStrategyOptions): this {
    this._executionStrategyOptions = options;
    return this;
  }

  /**
   * Enable spatial type support (WKB encoding/decoding) for this context.
   * Mirrors EF Core's `UseNetTopologySuite()` provider extension.
   *
   * When enabled, providers will automatically encode `Geometry` objects as
   * WKB/EWKB when writing, and decode WKB hex strings from the database into
   * typed `Geometry` objects when reading.
   *
   * @example
   * const opts = new DbContextOptionsBuilder({ provider })
   *   .useSpatial()
   *   .build();
   */
  useSpatial(): this {
    this._spatialEnabled = true;
    return this;
  }

  /**
   * Configure the migrations directory used by `ctx.database.hasPendingModelChanges()`,
   * `ctx.database.getPendingMigrations()`, and `ctx.database.migrate()`.
   *
   * Mirrors EF Core's per-context migration configuration.
   *
   * @example
   * const opts = new DbContextOptionsBuilder({ provider })
   *   .migrations({ directory: './migrations' })
   *   .build();
   */
  migrations(options: MigrationsOptions): this {
    this._migrationsDirectory = options.directory;
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
        : {}),
      ...(this._executionStrategyOptions !== undefined
        ? { executionStrategy: this._executionStrategyOptions }
        : {}),
      ...(this._spatialEnabled ? { spatialEnabled: true } : {}),
      ...(this._migrationsDirectory !== undefined
        ? { migrationsDirectory: this._migrationsDirectory }
        : {})
    };
  }
}
