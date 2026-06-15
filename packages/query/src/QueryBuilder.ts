import type { QueryOptions, SqlDialect, SqlLogger, SqlParameter } from '@ts-linq/types';
import type { SqlCache } from '@ts-linq/types';

import { CachingSqlCompiler } from './CachingSqlCompiler';
import type { SqlCacheMetrics } from './EnhancedSqlCache';
import { EnhancedSqlCache } from './EnhancedSqlCache';
import type { QueryModel } from './QueryModel';
import type { SqlCacheOptimizationInsights } from './SqlCacheCapabilities';
import { type SqlCompiler, SqlCompilerImpl } from './SqlCompiler';

/**
 * QueryBuilder is the internal facade over SQL compilation: a cache-agnostic
 * {@link SqlCompilerImpl} core wrapped by the {@link CachingSqlCompiler} decorator.
 *
 * @internal Not part of the stable public API. Import from `@ts-linq/query/internal`
 * if you genuinely need direct SQL compilation (not recommended).
 */
export class QueryBuilder implements SqlCompiler {
  private readonly _compiler: CachingSqlCompiler;

  /**
   * Create a QueryBuilder that delegates SQL generation to a dialect.
   * @param dialect SqlDialect implementation
   */
  constructor(
    dialect: SqlDialect,
    logger?: SqlLogger,
    providerName?: string,
    cache?: SqlCache,
    namespace?: string
  ) {
    const core = new SqlCompilerImpl(dialect);
    // Per-instance cache with no background timer when no external cache is provided.
    // Avoids global setInterval leaks; DbContext injects a shared EnhancedSqlCache instead.
    this._compiler = new CachingSqlCompiler(
      core,
      cache ?? new EnhancedSqlCache({ defaultTtl: 0 }),
      logger,
      providerName,
      namespace
    );
  }

  /** Generate SQL from QueryOptions with enhanced caching. */
  public generateSql<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: readonly SqlParameter[] } {
    return this._compiler.generateSql(entityClass, options);
  }

  /** Generate SQL from a QueryModel (preferred path). */
  public generateFromModel(
    entityClass: new () => unknown,
    model: QueryModel
  ): { query: string; parameters: readonly SqlParameter[] } {
    return this._compiler.generateFromModel(entityClass, model);
  }

  /** Generate a `COUNT(*)` query equivalent to the given model. */
  public generateCount(
    entityClass: new () => unknown,
    model: QueryModel
  ): { query: string; parameters: readonly SqlParameter[] } {
    return this._compiler.generateCount(entityClass, model);
  }

  /** Clear this instance's SQL cache. */
  public clearCache(): void {
    this._compiler.clearCache();
  }

  /** Dispose of this instance's cache resources (stops any background timers). */
  public dispose(): void {
    this._compiler.dispose();
  }

  /** Get cache metrics for performance monitoring (if using EnhancedSqlCache). */
  public getCacheMetrics(): SqlCacheMetrics {
    return this._compiler.getCacheMetrics();
  }

  /** Get optimization insights for cache tuning (if using EnhancedSqlCache). */
  public getOptimizationInsights(): SqlCacheOptimizationInsights {
    return this._compiler.getOptimizationInsights();
  }

  /**
   * Targeted invalidation: remove cached SQL entries for the given entity name.
   */
  public invalidateForEntity(entityName: string): number {
    return this._compiler.invalidateForEntity(entityName);
  }
}
