import type { QueryOptions, SqlParameter, SqlLogger, SqlDialect } from '@ts-linq/types';
import { safeCacheSize, safeCacheEvicted } from '@ts-linq/metrics-safe';
import type { QueryModel } from './QueryModel';
import type { SqlCache, SqlCacheEntry } from '@ts-linq/types';
import { EnhancedSqlCache } from './EnhancedSqlCache';

/**
 * QueryBuilder is now focused solely on generating SQL
 * from an entity class and accumulated query options.
 */
export class QueryBuilder {
  /** Default enhanced cache instance */
  private static _defaultCache: EnhancedSqlCache = new EnhancedSqlCache();
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
    this._cache = cache ?? QueryBuilder._defaultCache;
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
      distinct: model.distinct
    };
    const base = this.generateSql(entityClass, opts);
    // Handle UNION/UNION ALL chains
    if (model.unions && model.unions.length > 0) {
      let sql = `${base.query}`;
      const params: SqlParameter[] = [...base.parameters];
      for (const unionEntry of model.unions) {
        const next = this.generateFromModel(unionEntry.entity, unionEntry.other);
        sql += unionEntry.all ? ` UNION ALL ${next.query}` : ` UNION ${next.query}`;
        params.push(...next.parameters);
      }
      return { query: sql, parameters: params };
    }
    return base;
  }

  /** Clears the global SQL cache. Useful for tests or after metadata changes. */
  public static clearCache(): void {
    QueryBuilder._defaultCache.clear();
  }

  /** Dispose of the global cache resources. Useful for cleanup. */
  public static disposeCache(): void {
    QueryBuilder._defaultCache.dispose();
    QueryBuilder._defaultCache = new EnhancedSqlCache();
  }

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
    const whereArray = Array.isArray(options.where) ? options.where : (options.where ? [options.where] : []);
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
    const whereArray = Array.isArray(options.where) ? options.where : (options.where ? [options.where] : []);
    return whereArray
      .map((w) => `${w.condition}(${w.parameters?.join('|') ?? ''})`)
      .join('');
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
   * Targeted invalidation helper: remove cached SQL entries for the given entity name.
   */
  public static invalidateForEntity(entityName: string): number {
    const matcher = (k: string) => k.startsWith(entityName + '|');
    const cache = QueryBuilder._defaultCache as unknown as {
      invalidateBy?: (m: (k: string) => boolean) => number;
    };
    return cache.invalidateBy
      ? cache.invalidateBy(matcher)
      : (QueryBuilder._defaultCache.clear(), 0);
  }
}
