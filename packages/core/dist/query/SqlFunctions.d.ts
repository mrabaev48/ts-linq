/**
 * Minimal SQL window/functions DSL to help build expressions in a type-safe-ish way
 * without coupling to predicate parser. String-based columns to keep it simple.
 */
export type OrderDirection = 'ASC' | 'DESC';
declare class WindowBuilder {
    private readonly funcCall;
    private partitions;
    private orders;
    constructor(funcCall: string);
    partitionBy(columns: string | string[]): this;
    orderBy(column: string, direction?: OrderDirection): this;
    toString(): string;
    as(alias: string): string;
}
declare class RankFunction {
    over(): WindowBuilder;
}
declare class DenseRankFunction {
    over(): WindowBuilder;
}
declare class RowNumberFunction {
    over(): WindowBuilder;
}
export declare const sql: {
    rank(): RankFunction;
    denseRank(): DenseRankFunction;
    rowNumber(): RowNumberFunction;
    jsonExtract(column: string, path: string): ExprBuilder;
    jsonContains(column: string, json: string | number | boolean): ExprBuilder;
    mysqlMatchAgainst(columns: string | string[], query: string, mode?: "natural" | "boolean" | "query expansion"): ExprBuilder;
    pgToTsVector(columns: string | string[], config?: string): ExprBuilder;
    pgPlainToTsQuery(query: string, config?: string): ExprBuilder;
    pgWebsearchToTsQuery(query: string, config?: string): ExprBuilder;
    pgRank(vectorExpr: string, queryExpr: string): ExprBuilder;
};
export type SqlWindow = WindowBuilder;
import type { SqlExpression } from '../types';
declare class ExprBuilder implements SqlExpression {
    private readonly expr;
    private readonly params;
    constructor(expr: string, params?: unknown[]);
    toString(): string;
    getParameters(): readonly unknown[];
    as(alias: string): ExprBuilder;
}
export {};
//# sourceMappingURL=SqlFunctions.d.ts.map