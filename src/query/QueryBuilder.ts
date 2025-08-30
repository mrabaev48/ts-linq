import { QueryOptions } from '../types';
import { SqlDialect } from './SqlDialect';
import { SQLiteDialect } from './SQLiteDialect';
import { QueryModel } from './QueryModel';

/**
 * QueryBuilder is now focused solely on generating SQL
 * from an entity class and accumulated query options.
 */
export class QueryBuilder {
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
        return this._dialect.buildSelect(entityClass, options);
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
}
