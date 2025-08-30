import { QueryOptions } from '../types';
import { SqlDialect } from './SqlDialect';
import { SQLiteDialect } from './SQLiteDialect';

/**
 * QueryBuilder is now focused solely on generating SQL
 * from an entity class and accumulated query options.
 */
export class QueryBuilder {
    private _dialect: SqlDialect;
    constructor(dialect: SqlDialect = new SQLiteDialect()) {
        this._dialect = dialect;
    }
    public generateSql<T>(entityClass: new () => T, options: QueryOptions): { query: string; parameters: any[] } {
        return this._dialect.buildSelect(entityClass, options);
    }
}
