import type { QueryOptions, SqlParameter } from '../types';
import type { SqlLogger } from '../types';
import type { SqlDialect } from './SqlDialect';
import type { QueryModel } from './QueryModel';
import type { SqlCache } from './SqlCache';
/**
 * QueryBuilder is now focused solely on generating SQL
 * from an entity class and accumulated query options.
 */
export declare class QueryBuilder {
    /** Shared in-memory cache if external SqlCache is not provided. */
    private static _sqlCache;
    private static readonly _MAX_CACHE_SIZE;
    private _dialect;
    private _logger?;
    private _providerName?;
    private _cache?;
    /**
     * Create a QueryBuilder that delegates SQL generation to a dialect.
     * @param dialect SqlDialect implementation (default: SQLiteDialect)
     */
    constructor(dialect: SqlDialect, logger?: SqlLogger, providerName?: string, cache?: SqlCache);
    /** Generate SQL from QueryOptions (legacy path). */
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
    /** Create a stable, lightweight cache key. */
    private static buildCacheKey;
    /** Store an item in the cache with simple FIFO eviction. */
    private remember;
    private getFromCache;
}
//# sourceMappingURL=QueryBuilder.d.ts.map