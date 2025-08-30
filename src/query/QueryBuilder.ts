import { QueryOptions } from '../types';
import { SqlDialect } from './SqlDialect';
import { SQLiteDialect } from './SQLiteDialect';
import { QueryModel } from './QueryModel';

/**
 * QueryBuilder is now focused solely on generating SQL
 * from an entity class and accumulated query options.
 */
export class QueryBuilder {
    /** Shared cache for generated SQL keyed by entity + options hash. */
    private static _sqlCache: Map<string, { query: string; parameters: any[] }> = new Map();
    private static readonly _MAX_CACHE_SIZE = 1000;
    private _dialect: SqlDialect;
    /**
     * Create a QueryBuilder that delegates SQL generation to a dialect.
     * @param dialect SqlDialect implementation (default: SQLiteDialect)
     */
    constructor(dialect: SqlDialect = new SQLiteDialect()) {
        this._dialect = dialect;
    }
    /** Generate SQL from QueryOptions (legacy path). */
    public generateSql<T>(entityClass: new () => T, options: QueryOptions): { query: string; parameters: any[] } {
        const key = QueryBuilder.buildCacheKey(entityClass, options);
        const hit = QueryBuilder._sqlCache.get(key);
        if (hit) {
            return { query: hit.query, parameters: [...hit.parameters] };
        }
        const built = this._dialect.buildSelect(entityClass, options);
        QueryBuilder.remember(key, built);
        return built;
    }
    /** Generate SQL from a QueryModel (preferred path). */
    public generateFromModel<T>(entityClass: new () => T, model: QueryModel): { query: string; parameters: any[] } {
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
        return this.generateSql(entityClass, opts);
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
            where: options.where?.map(w => ({ condition: w.condition, parameters: [...w.parameters] })),
            orderBy: options.orderBy?.map(o => ({ column: o.column, direction: o.direction })),
            groupBy: options.groupBy ? {
                columns: [...options.groupBy.columns],
                having: options.groupBy.having ? { condition: options.groupBy.having.condition, parameters: [...options.groupBy.having.parameters] } : undefined
            } : undefined,
            joins: options.joins?.map(j => ({ type: j.type, table: j.table, on: j.on })),
            limit: options.limit ?? undefined,
            offset: options.offset ?? undefined,
            distinct: options.distinct ?? undefined
        };
        return `${entityClass.name}|${JSON.stringify(normalized)}`;
    }

    /** Store an item in the cache with simple FIFO eviction. */
    private static remember(key: string, value: { query: string; parameters: any[] }): void {
        if (QueryBuilder._sqlCache.size >= QueryBuilder._MAX_CACHE_SIZE) {
            const firstKey = QueryBuilder._sqlCache.keys().next().value as string | undefined;
            if (firstKey !== undefined) QueryBuilder._sqlCache.delete(firstKey);
        }
        QueryBuilder._sqlCache.set(key, { query: value.query, parameters: [...value.parameters] });
    }
}
