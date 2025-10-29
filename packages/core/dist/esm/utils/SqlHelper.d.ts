import type { SqlParameter } from '@ts-linq/types';
export declare class SqlHelper {
    /**
     * Build a WHERE clause from a simple conditions object.
     * - null/undefined -> IS NULL
     * - array -> IN (?, ?, ...)
     * - primitive -> = ?
     * @param conditions Key/value pairs to translate into SQL.
     * @returns Object with SQL fragment and parameter list.
     */
    static buildWhereClause(conditions: Record<string, unknown>): {
        whereClause: string;
        params: SqlParameter[];
    };
    /** Coerce an arbitrary value into a SqlParameter. */
    private static ensureSqlParameter;
    /**
     * Format a value for inline usage in SQL (e.g., DEFAULT expressions).
     * Escapes quotes for strings, formats dates as ISO strings.
     */
    static formatValue(value: unknown): string;
    /** Escape an identifier like a column or table name for SQL usage. */
    static escapeIdentifier(identifier: string): string;
    /** Build an ORDER BY clause string from column/direction pairs. */
    static buildOrderByClause(orderBy: Array<{
        column: string;
        direction: 'ASC' | 'DESC';
    }>): string;
    /** Build a LIMIT/OFFSET clause string. */
    static buildLimitClause(limit?: number, offset?: number): string;
}
//# sourceMappingURL=SqlHelper.d.ts.map