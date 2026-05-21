import { safeCacheSize } from '@ts-linq/metrics-safe';
import type { QueryOptions, SqlDialect, SqlLogger, SqlParameter } from '@ts-linq/types';
import type { SqlCache, SqlCacheEntry } from '@ts-linq/types';
import { isTemplateSqlCache } from '@ts-linq/types';

import { EnhancedSqlCache } from './EnhancedSqlCache';
import type { QueryModel } from './QueryModel';

/**
 * QueryBuilder is now focused solely on generating SQL
 * from an entity class and accumulated query options.
 */
export class QueryBuilder {
  private _dialect: SqlDialect;
  private _logger?: SqlLogger;
  private _providerName?: string;
  private _namespace?: string;
  private _cache: SqlCache;
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
    this._dialect = dialect;
    this._logger = logger;
    this._providerName = providerName;
    // Per-instance cache with no background timer when no external cache is provided.
    // Avoids global setInterval leaks; DbContext injects a shared EnhancedSqlCache instead.
    this._cache = cache ?? new EnhancedSqlCache({ defaultTtl: 0 });
    this._namespace = namespace;
  }
  /** Generate SQL from QueryOptions with enhanced caching. */
  public generateSql<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: readonly SqlParameter[] } {
    const key = QueryBuilder.buildCacheKey(
      entityClass,
      options,
      this._providerName,
      this._namespace
    );

    // Plan-level cache check (structure-only key). On hit, rebind current parameters
    // so stale values from the first compilation are never returned.
    if (isTemplateSqlCache(this._cache)) {
      const planKey = QueryBuilder.buildPlanKey(key);
      const template = this._cache.getTemplate(planKey);
      if (template) {
        this._logger?.cache?.({ cache: 'sqlGen', hit: true, provider: this._providerName });
        return { query: template.query, parameters: QueryBuilder.extractCurrentParams(options) };
      }
    }

    const hit = this.getFromCache(key);
    if (hit) {
      this._logger?.cache?.({ cache: 'sqlGen', hit: true, provider: this._providerName });
      return { query: hit.query, parameters: [...hit.parameters] } as const;
    }
    // Normalize expressions in select list to strings (dialect can still re-render)
    const normalized: QueryOptions = { ...options };
    if (options.select) {
      normalized.selectParams = [];
      normalized.select = options.select.map((s) => {
        if (typeof s === 'string') return s;
        const expr = s as unknown as {
          toString(): string;
          getParameters?: () => readonly unknown[];
        };
        const sqlStr = expr.toString();
        const params = expr.getParameters?.() ?? [];
        (normalized.selectParams as unknown[]).push(...params);
        return sqlStr;
      });
    }
    const built = this._dialect.buildSelect(entityClass, normalized);
    this.remember(key, built);

    // Populate plan cache template (SQL only, no parameter values)
    if (isTemplateSqlCache(this._cache)) {
      const planKey = QueryBuilder.buildPlanKey(key);
      this._cache.set(planKey, { query: built.query, parameters: [] });
    }

    this._logger?.cache?.({ cache: 'sqlGen', hit: false, provider: this._providerName });
    return built;
  }
  /** Generate SQL from a QueryModel (preferred path). */
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
      rawSqlSource: model.rawSqlSource
    };
    const base = this.generateSql(entityClass, opts);
    // Handle UNION / UNION ALL / EXCEPT / INTERSECT chains
    if (model.unions && model.unions.length > 0) {
      let sql = `${base.query}`;
      const params: SqlParameter[] = [...base.parameters];
      for (const unionEntry of model.unions) {
        const next = this.generateFromModel(unionEntry.entity, unionEntry.other);
        const kw = unionEntry.setOp ?? (unionEntry.all ? 'UNION ALL' : 'UNION');
        sql += ` ${kw} ${next.query}`;
        params.push(...next.parameters);
      }
      return { query: sql, parameters: params };
    }
    return base;
  }

  /** Clear this instance's SQL cache. */
  public clearCache(): void {
    this._cache.clear();
  }

  /** Dispose of this instance's cache resources (stops any background timers). */
  public dispose(): void {
    if (this._cache instanceof EnhancedSqlCache) {
      this._cache.dispose();
    }
  }

  /**
   * @deprecated Static cache has been removed. Use instance `clearCache()`.
   * This is now a no-op kept for backward compatibility.
   */
  public static clearCache(): void {}

  /**
   * @deprecated Static cache has been removed. Use instance `dispose()`.
   * This is now a no-op kept for backward compatibility.
   */
  public static disposeCache(): void {}

  /** Get cache metrics for performance monitoring (if using EnhancedSqlCache). */
  public getCacheMetrics() {
    if (this._cache instanceof EnhancedSqlCache) {
      return this._cache.getMetrics();
    }
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

  /** Get optimization insights for cache tuning (if using EnhancedSqlCache). */
  public getOptimizationInsights() {
    if (this._cache instanceof EnhancedSqlCache) {
      return this._cache.getOptimizationInsights();
    }
    // Fallback for basic cache interfaces
    return {
      shouldIncreaseSize: false,
      shouldDecreaseTtl: false,
      shouldIncreaseTtl: false,
      topAccessedEntries: []
    };
  }

  /** Create a stable, lightweight cache key. */
  private static buildCacheKey<T>(
    entityClass: new () => T,
    options: QueryOptions,
    providerName?: string,
    namespace?: string
  ): string {
    const parts: string[] = [];
    if (namespace) parts.push(namespace, '|');
    if (providerName) parts.push(providerName, '|');
    parts.push(entityClass.name);
    parts.push('|s:', options.select ? options.select.join(',') : '');
    const whereArray = Array.isArray(options.where)
      ? options.where
      : options.where
        ? [options.where]
        : [];
    if (whereArray.length) parts.push('|w:', QueryBuilder.serializeWhere(options));
    if (options.orderBy?.length) parts.push('|o:', QueryBuilder.serializeOrderBy(options));
    if (options.groupBy) parts.push('|g:', QueryBuilder.serializeGroupBy(options));
    if (options.joins?.length) parts.push('|j:', QueryBuilder.serializeJoins(options));
    if (options.limit !== undefined) parts.push('|l:', String(options.limit));
    if (options.offset !== undefined) parts.push('|f:', String(options.offset));
    if (options.distinct) parts.push('|d:1');
    return parts.join('');
  }

  private static serializeWhere(options: QueryOptions): string {
    const whereArray = Array.isArray(options.where)
      ? options.where
      : options.where
        ? [options.where]
        : [];
    return whereArray.map((w) => `${w.condition}(${w.parameters?.join('|') ?? ''})`).join('');
  }

  private static serializeOrderBy(options: QueryOptions): string {
    return (options.orderBy ?? []).map((o) => `${o.column}:${o.direction};`).join('');
  }

  private static serializeGroupBy(options: QueryOptions): string {
    const gb = options.groupBy!;
    if (Array.isArray(gb)) {
      return gb.join(',');
    }
    const base = gb.columns.join(',');
    if (!gb.having) return base;
    const hv = `{${gb.having.condition}(${gb.having.parameters?.join('|') ?? ''})}`;
    return base + hv;
  }

  private static serializeJoins(options: QueryOptions): string {
    return (options.joins ?? []).map((j) => `${j.type}:${j.table}:${j.on};`).join('');
  }

  /**
   * Build a structure-only plan key by stripping parameter values from a full cache key.
   * Used by the plan-level (TemplateSqlCache) code path.
   */
  private static buildPlanKey(fullKey: string): string {
    return fullKey
      .replace(/\?\(([^)]*)\)/g, '?()') // strip ?(val) after ? placeholders
      .replace(/\)\(([^()]*)\)/g, ')()'); // strip )(val) groups (whereIn / IN-clause params)
  }

  /**
   * Re-extract all current SQL parameters from QueryOptions.
   * Called when a plan-cache hit is found so the cached SQL template is reused
   * but fresh parameter values are bound for this invocation.
   */
  private static extractCurrentParams(options: QueryOptions): SqlParameter[] {
    const params: SqlParameter[] = [];
    const wheres = Array.isArray(options.where)
      ? options.where
      : options.where
        ? [options.where]
        : [];
    for (const w of wheres) {
      if (w.parameters) params.push(...w.parameters);
    }
    if (options.groupBy && !Array.isArray(options.groupBy) && options.groupBy.having?.parameters) {
      params.push(...options.groupBy.having.parameters);
    }
    if (options.rawSqlSource) {
      params.push(...options.rawSqlSource.params);
    }
    if (options.selectParams) {
      params.push(...(options.selectParams as SqlParameter[]));
    }
    return params;
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

  /**
   * Targeted invalidation: remove cached SQL entries for the given entity name.
   */
  public invalidateForEntity(entityName: string): number {
    const matcher = (k: string) => k.startsWith(entityName + '|');
    const cache = this._cache as unknown as {
      invalidateBy?: (m: (k: string) => boolean) => number;
    };
    return cache.invalidateBy ? cache.invalidateBy(matcher) : (this._cache.clear(), 0);
  }

  /**
   * @deprecated Static cache has been removed. Invalidate via DbContext or the instance method.
   * This is now a no-op kept for backward compatibility.
   */
  public static invalidateForEntity(_entityName: string): number {
    return 0;
  }
}
