import type { SqlDialect, QueryOptions, SqlParameter } from '@ts-linq/core';
/**
 * MySQL dialect for SELECT generation.
 *
 * - Uses LIMIT and OFFSET (LIMIT n OFFSET m)
 * - Leaves '?' placeholders as-is (mysql2 supports positional params)
 */
export declare class MysqlDialect implements SqlDialect {
  private readonly whereEmitter;
  private readonly joinEmitter;
  private readonly orderEmitter;
  private readonly groupEmitter;
  quoteIdentifier(identifier: string): string;
  /**
   * Build SELECT for MySQL based on normalized QueryOptions.
   * @param entityClass Entity constructor to resolve table name
   * @param options Normalized query options (select/where/order/joins/group/limit/offset)
   */
  buildSelect<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): {
    query: string;
    parameters: readonly SqlParameter[];
  };
  private buildSelectHead;
  private buildFromClause;
  private collectSelectParams;
  private buildLimitOffset;
}
//# sourceMappingURL=MysqlDialect.d.ts.map
