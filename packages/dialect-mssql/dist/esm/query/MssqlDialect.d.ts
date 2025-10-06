import type { SqlDialect, QueryOptions, SqlParameter } from '@ts-linq/core';
export declare class MssqlDialect implements SqlDialect {
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
  private numberPlaceholders;
  private collectSelectParams;
  private buildSelectHead;
  private buildOffsetFetch;
}
//# sourceMappingURL=MssqlDialect.d.ts.map
