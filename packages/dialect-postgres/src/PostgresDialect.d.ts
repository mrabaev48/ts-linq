import type { SqlDialect, QueryOptions, SqlParameter } from '@ts-linq/core';
export declare class PostgresDialect implements SqlDialect {
    private readonly whereEmitter;
    private readonly joinEmitter;
    private readonly orderEmitter;
    private readonly groupEmitter;
    quoteIdentifier(identifier: string): string;
    buildSelect<T>(entityClass: new () => T, options: QueryOptions): {
        query: string;
        parameters: readonly SqlParameter[];
    };
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