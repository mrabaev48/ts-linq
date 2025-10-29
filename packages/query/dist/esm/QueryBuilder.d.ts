import type { QueryOptions, SqlParameter, SqlLogger, SqlDialect } from '@ts-linq/types';
import type { QueryModel } from './QueryModel';
import type { SqlCache } from '@ts-linq/types';
/**
 * QueryBuilder is now focused solely on generating SQL
 * from an entity class and accumulated query options.
 */
export declare class QueryBuilder {
    /** Default enhanced cache instance */
    private static _defaultCache;
    private _dialect;
    private _logger?;
    private _providerName?;
    private _namespace?;
    private _cache;
    /**
     * Create a QueryBuilder that delegates SQL generation to a dialect.
     * @param dialect SqlDialect implementation (default: SQLiteDialect)
     */
    constructor(dialect: SqlDialect, logger?: SqlLogger, providerName?: string, cache?: SqlCache, namespace?: string);
    /** Generate SQL from QueryOptions with enhanced caching. */
    generateSql<T>(entityClass: new () => T, options: QueryOptions): {
        query: string;
        parameters: readonly SqlParameter[];
    };
    /** Generate SQL from a QueryModel (preferred path). */
    generateFromModel(entityClass: new () => unknown, model: QueryModel): {
        query: string;
        parameters: readonly SqlParameter[];
    };
    /** Clears the global SQL cache. Useful for tests or after metadata changes. */
    static clearCache(): void;
    /** Dispose of the global cache resources. Useful for cleanup. */
    static disposeCache(): void;
    /** Get cache metrics for performance monitoring (if using EnhancedSqlCache). */
    getCacheMetrics(): import("./EnhancedSqlCache").SqlCacheMetrics;
    /** Get optimization insights for cache tuning (if using EnhancedSqlCache). */
    getOptimizationInsights(): {
        shouldIncreaseSize: boolean;
        shouldDecreaseTtl: boolean;
        shouldIncreaseTtl: boolean;
        topAccessedEntries: Array<{
            key: string;
            accessCount: number;
        }>;
    };
    /** Create a stable, lightweight cache key. */
    private static buildCacheKey;
    private static serializeWhere;
    private static serializeOrderBy;
    private static serializeGroupBy;
    private static serializeJoins;
    /** Store an item in the cache. */
    private remember;
    private getFromCache;
    /**
     * Targeted invalidation helper: remove cached SQL entries for the given entity name.
     */
    static invalidateForEntity(entityName: string): number;
}
//# sourceMappingURL=QueryBuilder.d.ts.map