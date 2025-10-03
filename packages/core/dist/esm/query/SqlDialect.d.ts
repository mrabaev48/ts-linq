import type { QueryOptions, SqlParameter } from '../types';
/**
 * SQL dialect contract used by QueryBuilder to produce vendor-specific SQL.
 * Implementations translate normalized QueryOptions into a SQL string and parameters.
 */
export interface SqlDialect {
    /**
     * Build a SELECT statement for the given entity and options.
     * @param entityClass Entity constructor (to resolve table/columns via metadata)
     * @param options Normalized query options (select/where/order/limit/...)
     * @returns SQL string and parameter array ready for execution
     */
    buildSelect<T>(entityClass: new () => T, options: QueryOptions): {
        query: string;
        parameters: readonly SqlParameter[];
    };
    /** Quote an identifier (table/column). Default: no quoting. Dialects override. */
    quoteIdentifier?(identifier: string): string;
}
//# sourceMappingURL=SqlDialect.d.ts.map