import { safeCacheSize } from '@ts-linq/metrics-safe';
import { emitTagComments } from '@ts-linq/sql-visitor';
import type {
  QueryOptions,
  SqlCache,
  SqlCacheEntry,
  SqlLogger,
  SqlParameter
} from '@ts-linq/types';
import { isTemplateSqlCache } from '@ts-linq/types';

import { CacheKeyBuilder } from './CacheKeyBuilder';
import type { SqlCacheMetrics } from './EnhancedSqlCache';
import type { QueryModel } from './QueryModel';
import type { SqlCacheCapabilities, SqlCacheOptimizationInsights } from './SqlCacheCapabilities';
import { buildCountModel, type SqlCompiler } from './SqlCompiler';

/**
 * Decorator that adds SQL-generation caching (full + plan-template strategies) and
 * cache lifecycle/metrics around a cache-agnostic {@link SqlCompiler} core.
 */
export class CachingSqlCompiler implements SqlCompiler {
  constructor(
    private readonly _core: SqlCompiler,
    private readonly _cache: SqlCache,
    private readonly _logger?: SqlLogger,
    private readonly _providerName?: string,
    private readonly _namespace?: string
  ) {}

  public generateSql<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: readonly SqlParameter[] } {
    const key = CacheKeyBuilder.build(entityClass, options, this._providerName, this._namespace);

    // Plan-level cache check (structure-only key). On hit, rebind current parameters
    // so stale values from the first compilation are never returned.
    if (isTemplateSqlCache(this._cache)) {
      const planKey = CacheKeyBuilder.buildPlanKey(key);
      const template = this._cache.getTemplate(planKey);
      if (template) {
        this._logger?.cache?.({ cache: 'sqlGen', hit: true, provider: this._providerName });
        return { query: template.query, parameters: CacheKeyBuilder.extractCurrentParams(options) };
      }
    }

    const hit = this.getFromCache(key);
    if (hit) {
      this._logger?.cache?.({ cache: 'sqlGen', hit: true, provider: this._providerName });
      return { query: hit.query, parameters: [...hit.parameters] } as const;
    }

    const built = this._core.generateSql(entityClass, options);
    this.remember(key, built);

    // Populate plan cache template (SQL only, no parameter values)
    if (isTemplateSqlCache(this._cache)) {
      const planKey = CacheKeyBuilder.buildPlanKey(key);
      this._cache.set(planKey, { query: built.query, parameters: [] });
    }

    this._logger?.cache?.({ cache: 'sqlGen', hit: false, provider: this._providerName });
    return built;
  }

  public generateFromModel(
    entityClass: new () => unknown,
    model: QueryModel
  ): { query: string; parameters: readonly SqlParameter[] } {
    const opts: QueryOptions = {
      select: model.select,
      where: model.where,
      orderBy: model.orderBy,
      groupBy: model.groupBy,
      joins: model.joins,
      limit: model.limit,
      offset: model.offset,
      distinct: model.distinct,
      from: model.from,
      rawSqlSource: model.rawSqlSource,
      temporal: model.temporal
    };
    const base = this.generateSql(entityClass, opts);

    // Build the final SQL: tags are prepended OUTSIDE the cache so the cache holds clean SQL.
    const tagPrefix = model.tags && model.tags.length > 0 ? emitTagComments(model.tags) : '';

    // Handle UNION / UNION ALL / EXCEPT / INTERSECT chains
    if (model.unions && model.unions.length > 0) {
      let sql = `${base.query}`;
      const params: SqlParameter[] = [...base.parameters];
      for (const unionEntry of model.unions) {
        const next = this.generateFromModel(unionEntry.entity, unionEntry.other);
        const kw = unionEntry.setOp ?? (unionEntry.all ? 'UNION ALL' : 'UNION');
        // Strip any tag prefix from sub-queries before joining (tags belong to the root only)
        const nextSqlBody = next.query;
        sql += ` ${kw} ${nextSqlBody}`;
        params.push(...next.parameters);
      }
      return { query: tagPrefix + sql, parameters: params };
    }

    return { query: tagPrefix + base.query, parameters: base.parameters };
  }

  public generateCount(
    entityClass: new () => unknown,
    model: QueryModel
  ): { query: string; parameters: readonly SqlParameter[] } {
    return this.generateFromModel(entityClass, buildCountModel(model));
  }

  /** Clear this instance's SQL cache. */
  public clearCache(): void {
    this._cache.clear();
  }

  /** Dispose of this instance's cache resources (stops any background timers). */
  public dispose(): void {
    (this._cache as unknown as SqlCacheCapabilities).dispose?.();
  }

  /** Get cache metrics for performance monitoring (if the cache exposes them). */
  public getCacheMetrics(): SqlCacheMetrics {
    const metrics = (this._cache as unknown as SqlCacheCapabilities).getMetrics?.();
    if (metrics) return metrics;
    // Fallback for basic cache interfaces
    return {
      currentSize: this._cache.size?.() ?? 0,
      totalRequests: 0,
      hits: 0,
      misses: 0,
      hitRatio: 0,
      evictions: 0,
      expirations: 0,
      averageAccessCount: 0,
      estimatedMemoryUsage: 0
    };
  }

  /** Get optimization insights for cache tuning (if the cache exposes them). */
  public getOptimizationInsights(): SqlCacheOptimizationInsights {
    const insights = (this._cache as unknown as SqlCacheCapabilities).getOptimizationInsights?.();
    if (insights) return insights;
    // Fallback for basic cache interfaces
    return {
      shouldIncreaseSize: false,
      shouldDecreaseTtl: false,
      shouldIncreaseTtl: false,
      topAccessedEntries: []
    };
  }

  /**
   * Targeted invalidation: remove cached SQL entries for the given entity name.
   */
  public invalidateForEntity(entityName: string): number {
    const matcher = (k: string) => k.startsWith(entityName + '|');
    return this._cache.invalidateBy ? this._cache.invalidateBy(matcher) : (this._cache.clear(), 0);
  }

  /** Store an item in the cache. */
  private remember(
    key: string,
    value: { query: string; parameters: readonly SqlParameter[] }
  ): void {
    this._cache.set(key, { query: value.query, parameters: [...value.parameters] });
    safeCacheSize(this._logger, {
      cache: 'sqlGen',
      size: this._cache.size?.() ?? -1,
      provider: this._providerName
    });
  }

  private getFromCache(key: string): SqlCacheEntry | undefined {
    return this._cache.get(key);
  }
}
