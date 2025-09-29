import type { SqlDialect, QueryOptions, SqlParameter } from '@ts-linq/core';
/**
 * SQLite implementation of SqlDialect.
 * Handles DISTINCT, WHERE (prebuilt), GROUP BY/HAVING, ORDER BY and LIMIT/OFFSET.
 * Adds SQLite-specific quirk: LIMIT -1 when OFFSET is provided without LIMIT.
 */
export declare class SQLiteDialect implements SqlDialect {
    quoteIdentifier(identifier: string): string;
    /** Build SQL for a SELECT based on normalized QueryOptions.
     * @param entityClass Entity constructor (for table name resolution)
     * @param options Normalized query options
     */
    buildSelect<T>(entityClass: new () => T, options: QueryOptions): {
        query: string;
        parameters: readonly SqlParameter[];
    };
}
//# sourceMappingURL=SQLiteDialect.d.ts.map