import type { SqlDialect, QueryOptions, SqlParameter } from '@ts-linq/core';
export declare class SQLiteDialect implements SqlDialect {
  private readonly whereEmitter;
  private readonly joinEmitter;
  private readonly orderEmitter;
  private readonly groupEmitter;
  quoteIdentifier(identifier: string): string;
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
//# sourceMappingURL=SQLiteDialect.d.ts.map
