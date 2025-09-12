import type { QueryOptions, SqlParameter } from '../types';
import type { SqlLogger } from '../types';
import type { SqlDialect } from './SqlDialect';
import { safeCacheSize, safeCacheEvicted } from '../utils/MetricsSafe';
import { SQLiteDialect } from './SQLiteDialect';
import type { QueryModel } from './QueryModel';
import type { SqlCache, SqlCacheEntry } from './SqlCache';

/**
 * QueryBuilder is now focused solely on generating SQL
 * from an entity class and accumulated query options.
 */
export class QueryBuilder {
  /** Shared in-memory cache if external SqlCache is not provided. */
  private static _sqlCache: Map<string, { query: string; parameters: SqlParameter[] }> = new Map();
  private static readonly _MAX_CACHE_SIZE = 1000;
  private _dialect: SqlDialect;
  private _logger?: SqlLogger;
  private _providerName?: string;
  private _cache?: SqlCache;
  /**
   * Create a QueryBuilder that delegates SQL generation to a dialect.
   * @param dialect SqlDialect implementation (default: SQLiteDialect)
   */
  constructor(
    dialect: SqlDialect = new SQLiteDialect(),
    logger?: SqlLogger,
    providerName?: string,
    cache?: SqlCache
  ) {
    this._dialect = dialect;
    this._logger = logger;
    this._providerName = providerName;
    this._cache = cache;
  }
  /** Generate SQL from QueryOptions (legacy path). */
  public generateSql<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: readonly SqlParameter[] } {
    const key = QueryBuilder.buildCacheKey(entityClass, options);
    const hit = this.getFromCache(key);
    if (hit) {
      this._logger?.cache?.({ cache: 'sqlGen', hit: true, provider: this._providerName });
      return { query: hit.query, parameters: [...hit.parameters] } as const;
    }
    const built = this._dialect.buildSelect(entityClass, options);
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
    QueryBuilder._sqlCache.clear();
  }

  /** Create a stable, lightweight cache key. */
  private static buildCacheKey<T>(entityClass: new () => T, options: QueryOptions): string {
    let key = entityClass.name;
    key += '|s:' + (options.select ? options.select.join(',') : '');
    if (options.where && options.where.length) {
      key += '|w:';
      for (const whereClause of options.where) {
        key += whereClause.condition + '(' + (whereClause.parameters?.join('|') ?? '') + ')';
      }
    }
    if (options.orderBy && options.orderBy.length) {
      key += '|o:';
      for (const orderBy of options.orderBy) key += orderBy.column + ':' + orderBy.direction + ';';
    }
    if (options.groupBy) {
      key += '|g:' + options.groupBy.columns.join(',');
      if (options.groupBy.having)
        key +=
          '{' +
          options.groupBy.having.condition +
          '(' +
          (options.groupBy.having.parameters?.join('|') ?? '') +
          ')}';
    }
    if (options.joins && options.joins.length) {
      key += '|j:';
      for (const joinClause of options.joins)
        key += joinClause.type + ':' + joinClause.table + ':' + joinClause.on + ';';
    }
    if (options.limit !== undefined) key += '|l:' + options.limit;
    if (options.offset !== undefined) key += '|f:' + options.offset;
    if (options.distinct) key += '|d:1';
    return key;
  }

  /** Store an item in the cache with simple FIFO eviction. */
  private remember(
    key: string,
    value: { query: string; parameters: readonly SqlParameter[] }
  ): void {
    if (this._cache) {
      this._cache.set(key, { query: value.query, parameters: [...value.parameters] });
      safeCacheSize(this._logger, {
        cache: 'sqlGen',
        size: this._cache.size?.() ?? -1,
        provider: this._providerName
      });
      return;
    }
    if (QueryBuilder._sqlCache.size >= QueryBuilder._MAX_CACHE_SIZE) {
      const firstKey = QueryBuilder._sqlCache.keys().next().value;
      if (firstKey !== undefined) {
        QueryBuilder._sqlCache.delete(firstKey);
        safeCacheEvicted(this._logger, { cache: 'sqlGen', provider: this._providerName });
      }
    }
    QueryBuilder._sqlCache.set(key, { query: value.query, parameters: [...value.parameters] });
    safeCacheSize(this._logger, {
      cache: 'sqlGen',
      size: QueryBuilder._sqlCache.size,
      provider: this._providerName
    });
  }

  private getFromCache(key: string): SqlCacheEntry | undefined {
    if (this._cache) return this._cache.get(key);
    const val = QueryBuilder._sqlCache.get(key);
    if (val) {
      // LRU touch: move to the most-recent position
      QueryBuilder._sqlCache.delete(key);
      QueryBuilder._sqlCache.set(key, val);
    }
    return val;
  }
}
