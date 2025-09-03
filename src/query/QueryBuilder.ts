import { QueryOptions } from '../types';
import { SqlLogger } from '../types';
import { SqlDialect } from './SqlDialect';
import { safeCacheSize, safeCacheEvicted } from '../utils/MetricsSafe';
import { SQLiteDialect } from './SQLiteDialect';
import { QueryModel } from './QueryModel';
import { SqlCache, SqlCacheEntry } from './SqlCache';

/**
 * QueryBuilder is now focused solely on generating SQL
 * from an entity class and accumulated query options.
 */
export class QueryBuilder {
  /** Shared in-memory cache if external SqlCache is not provided. */
  private static _sqlCache: Map<string, { query: string; parameters: any[] }> = new Map();
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
  ): { query: string; parameters: any[] } {
    const key = QueryBuilder.buildCacheKey(entityClass, options);
    const hit = this.getFromCache(key);
    if (hit) {
      this._logger?.cache?.({ cache: 'sqlGen', hit: true, provider: this._providerName });
      return { query: hit.query, parameters: [...hit.parameters] };
    }
    const built = this._dialect.buildSelect(entityClass, options);
    this.remember(key, built);
    this._logger?.cache?.({ cache: 'sqlGen', hit: false, provider: this._providerName });
    return built;
  }
  /** Generate SQL from a QueryModel (preferred path). */
  public generateFromModel<T>(
    entityClass: new () => T,
    model: QueryModel
  ): { query: string; parameters: any[] } {
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
      let params = [...base.parameters];
      for (const unionEntry of model.unions) {
        const next = this.generateFromModel(unionEntry.entity as any, unionEntry.other);
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

  /** Create a stable cache key from entity constructor and query options. */
  private static buildCacheKey<T>(entityClass: new () => T, options: QueryOptions): string {
    // Normalize undefineds to keep stable JSON representation
    const normalized: QueryOptions = {
      select: options.select ?? undefined,
      where: options.where?.map((w) => ({ condition: w.condition, parameters: [...w.parameters] })),
      orderBy: options.orderBy?.map((o) => ({ column: o.column, direction: o.direction })),
      groupBy: options.groupBy
        ? {
            columns: [...options.groupBy.columns],
            having: options.groupBy.having
              ? {
                  condition: options.groupBy.having.condition,
                  parameters: [...options.groupBy.having.parameters]
                }
              : undefined
          }
        : undefined,
      joins: options.joins?.map((j) => ({ type: j.type, table: j.table, on: j.on })),
      limit: options.limit ?? undefined,
      offset: options.offset ?? undefined,
      distinct: options.distinct ?? undefined
    };
    return `${entityClass.name}|${JSON.stringify(normalized)}`;
  }

  /** Store an item in the cache with simple FIFO eviction. */
  private remember(key: string, value: { query: string; parameters: any[] }): void {
    if (this._cache) {
      this._cache.set(key, { query: value.query, parameters: [...value.parameters] });
      try {
        (this._logger as any)?.cacheSize?.({
          cache: 'sqlGen',
          size: this._cache.size?.() ?? -1,
          provider: this._providerName
        });
      } catch {/* ignore */}
      return;
    }
    if (QueryBuilder._sqlCache.size >= QueryBuilder._MAX_CACHE_SIZE) {
      const firstKey = QueryBuilder._sqlCache.keys().next().value as string | undefined;
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
    return QueryBuilder._sqlCache.get(key);
  }
}
