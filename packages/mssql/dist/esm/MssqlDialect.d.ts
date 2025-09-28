import { SqlDialect, QueryOptions, SqlParameter } from '@ts-linq/core';
/**
 * MSSQL dialect for SELECT generation.
 *
 * - Adds TOP n when limit is used without offset
 * - Uses OFFSET n ROWS FETCH NEXT m ROWS ONLY when offset is provided
 * - Converts '?' placeholders to @p1..@pn for MSSQL parameter style
 */
export declare class MssqlDialect implements SqlDialect {
  quoteIdentifier(identifier: string): string;
  /**
   * Build a SELECT statement for MSSQL based on normalized QueryOptions.
   * @param entityClass Entity constructor to resolve table name from metadata
   * @param options Normalized query options (select/where/joins/order/limit/offset)
   * @returns SQL string and positional parameter array
   */
  buildSelect<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): {
    query: string;
    parameters: readonly SqlParameter[];
  };
  /** Replace '?' placeholders with @p1..@pn. */
  private numberPlaceholders;
}
//# sourceMappingURL=MssqlDialect.d.ts.map
