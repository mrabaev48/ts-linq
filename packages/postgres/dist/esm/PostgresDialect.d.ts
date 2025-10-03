import type { SqlDialect, QueryOptions, SqlParameter } from '@ts-linq/core';
/**
 * PostgreSQL implementation of SqlDialect.
 *
 * - Builds SELECT statements with optional JOIN/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT/OFFSET
 * - Converts positional placeholders from '?' to PostgreSQL-style $1..$n
 * - Leaves identifier quoting to providers/metadata (table/column names are passed as-is)
 */
/**
 * @deprecated Use `PostgresDialect` from `@ts-linq/dialect-postgres` instead.
 */
export declare class PostgresDialect implements SqlDialect {
    private readonly whereEmitter;
    private readonly joinEmitter;
    private readonly orderEmitter;
    private readonly groupEmitter;
    quoteIdentifier(identifier: string): string;
    /**
     * Generate a PostgreSQL SELECT query from normalized QueryOptions.
     * @param entityClass Entity constructor to resolve table name
     * @param options Normalized query options (select/where/order/group/joins/limit/offset)
     */
    buildSelect<T>(entityClass: new () => T, options: QueryOptions): {
        query: string;
        parameters: readonly SqlParameter[];
    };
    /** Replace all '?' placeholders by $1..$n according to their order. */
    private numberPlaceholders;
    private buildSelectHead;
    private applyCte;
    private buildFromClause;
    private buildJoins;
    private collectSelectParams;
    private buildWhereClause;
    private buildGroupByHaving;
    private buildOrderBy;
    private buildLimitOffset;
}
//# sourceMappingURL=PostgresDialect.d.ts.map