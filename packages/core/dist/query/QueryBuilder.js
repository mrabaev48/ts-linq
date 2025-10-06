'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.QueryBuilder = void 0;
const metrics_safe_1 = require('metrics-safe');
const EnhancedSqlCache_1 = require('./EnhancedSqlCache');
/**
 * QueryBuilder is now focused solely on generating SQL
 * from an entity class and accumulated query options.
 */
class QueryBuilder {
  /**
   * Create a QueryBuilder that delegates SQL generation to a dialect.
   * @param dialect SqlDialect implementation (default: SQLiteDialect)
   */
  constructor(dialect, logger, providerName, cache) {
    this._dialect = dialect;
    this._logger = logger;
    this._providerName = providerName;
    this._cache = cache ?? QueryBuilder._defaultCache;
  }
  /** Generate SQL from QueryOptions with enhanced caching. */
  generateSql(entityClass, options) {
    const key = QueryBuilder.buildCacheKey(entityClass, options);
    const hit = this.getFromCache(key);
    if (hit) {
      this._logger?.cache?.({ cache: 'sqlGen', hit: true, provider: this._providerName });
      return { query: hit.query, parameters: [...hit.parameters] };
    }
    // Normalize expressions in select list to strings (dialect can still re-render)
    const normalized = { ...options };
    if (options.select) {
      normalized.selectParams = [];
      normalized.select = options.select.map((s) => {
        if (typeof s === 'string') return s;
        const expr = s;
        const sqlStr = expr.toString();
        const params = expr.getParameters?.() ?? [];
        normalized.selectParams.push(...params);
        return sqlStr;
      });
    }
    const built = this._dialect.buildSelect(entityClass, normalized);
    this.remember(key, built);
    this._logger?.cache?.({ cache: 'sqlGen', hit: false, provider: this._providerName });
    return built;
  }
  /** Generate SQL from a QueryModel (preferred path). */
  generateFromModel(entityClass, model) {
    const opts = {
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
      const params = [...base.parameters];
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
  static clearCache() {
    QueryBuilder._defaultCache.clear();
  }
  /** Dispose of the global cache resources. Useful for cleanup. */
  static disposeCache() {
    QueryBuilder._defaultCache.dispose();
    QueryBuilder._defaultCache = new EnhancedSqlCache_1.EnhancedSqlCache();
  }
  /** Get cache metrics for performance monitoring (if using EnhancedSqlCache). */
  getCacheMetrics() {
    if (this._cache instanceof EnhancedSqlCache_1.EnhancedSqlCache) {
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
  getOptimizationInsights() {
    if (this._cache instanceof EnhancedSqlCache_1.EnhancedSqlCache) {
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
  static buildCacheKey(entityClass, options) {
    const parts = [];
    parts.push(entityClass.name);
    parts.push('|s:', options.select ? options.select.join(',') : '');
    if (options.where?.length) parts.push('|w:', QueryBuilder.serializeWhere(options));
    if (options.orderBy?.length) parts.push('|o:', QueryBuilder.serializeOrderBy(options));
    if (options.groupBy) parts.push('|g:', QueryBuilder.serializeGroupBy(options));
    if (options.joins?.length) parts.push('|j:', QueryBuilder.serializeJoins(options));
    if (options.limit !== undefined) parts.push('|l:', String(options.limit));
    if (options.offset !== undefined) parts.push('|f:', String(options.offset));
    if (options.distinct) parts.push('|d:1');
    return parts.join('');
  }
  static serializeWhere(options) {
    return (options.where ?? [])
      .map((w) => `${w.condition}(${w.parameters?.join('|') ?? ''})`)
      .join('');
  }
  static serializeOrderBy(options) {
    return (options.orderBy ?? []).map((o) => `${o.column}:${o.direction};`).join('');
  }
  static serializeGroupBy(options) {
    const gb = options.groupBy;
    const base = gb.columns.join(',');
    if (!gb.having) return base;
    const hv = `{${gb.having.condition}(${gb.having.parameters?.join('|') ?? ''})}`;
    return base + hv;
  }
  static serializeJoins(options) {
    return (options.joins ?? []).map((j) => `${j.type}:${j.table}:${j.on};`).join('');
  }
  /** Store an item in the cache. */
  remember(key, value) {
    this._cache.set(key, { query: value.query, parameters: [...value.parameters] });
    (0, metrics_safe_1.safeCacheSize)(this._logger, {
      cache: 'sqlGen',
      size: this._cache.size?.() ?? -1,
      provider: this._providerName
    });
  }
  getFromCache(key) {
    return this._cache.get(key);
  }
}
exports.QueryBuilder = QueryBuilder;
/** Default enhanced cache instance */
QueryBuilder._defaultCache = new EnhancedSqlCache_1.EnhancedSqlCache();
//# sourceMappingURL=QueryBuilder.js.map
