import type { DbContextOptions } from '@ts-linq/core';
import { WarningConfigurationBuilder } from '@ts-linq/telemetry';
import type {
  DiagnosticConfig,
  ExecutionStrategyOptions,
  LogLevel,
  WarningBehavior
} from '@ts-linq/types';
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

  // ── Diagnostic logging state ─────────────────────────────────────────────
  private _logSink?: (message: string) => void;
  private _logLevel?: LogLevel;
  private _sensitiveDataEnabled = false;
  private _detailedErrors = false;
  private _warningRoutes?: ReadonlyMap<string, WarningBehavior>;

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
   * Direct diagnostic events to a user-supplied sink function.
   * Mirrors EF Core's `optionsBuilder.LogTo(sink, logLevel)`.
   *
   * @param sink     Function that receives formatted diagnostic messages.
   * @param level    Minimum severity forwarded to the sink. Defaults to 'information'.
   *
   * @example
   * new DbContextOptionsBuilder({ provider })
   *   .logTo(msg => console.log(msg), 'debug')
   *   .build();
   */
  logTo(sink: (message: string) => void, level?: LogLevel): this {
    this._logSink = sink;
    this._logLevel = level;
    return this;
  }

  /**
   * Include raw SQL parameter values in diagnostic messages.
   * By default parameters are masked as :p0, :p1, … to prevent PII leakage.
   * Call this only in non-production environments.
   * Mirrors EF Core's `optionsBuilder.EnableSensitiveDataLogging()`.
   */
  enableSensitiveDataLogging(): this {
    this._sensitiveDataEnabled = true;
    return this;
  }

  /**
   * Append full stack traces to error diagnostic messages.
   * Mirrors EF Core's `optionsBuilder.EnableDetailedErrors()`.
   */
  enableDetailedErrors(): this {
    this._detailedErrors = true;
    return this;
  }

  /**
   * Configure per-event warning routing: escalate to exception, force-log, or suppress.
   * Mirrors EF Core's `optionsBuilder.ConfigureWarnings(w => w.Throw(...).Log(...))`.
   *
   * @example
   * new DbContextOptionsBuilder({ provider })
   *   .configureWarnings(w => w
   *     .throw('relational.multiple-collection-include')
   *     .log('core.first-without-order-by-and-filter'))
   *   .build();
   */
  configureWarnings(configure: (w: WarningConfigurationBuilder) => void): this {
    const builder = new WarningConfigurationBuilder();
    configure(builder);
    this._warningRoutes = builder.build();
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
        : {}),
      ...(this._logSink !== undefined
        ? {
            logging: {
              sink: this._logSink,
              level: this._logLevel,
              sensitiveDataEnabled: this._sensitiveDataEnabled,
              detailedErrors: this._detailedErrors,
              warningRoutes: this._warningRoutes
            } satisfies DiagnosticConfig
          }
        : {})
    };
  }
}
