type LoggerLike = {
  warn(message: string, error?: unknown): void;
};
export type PgIndexSpec = {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
  orders?: {
    [column: string]: 'ASC' | 'DESC';
  };
  expressions?: string[];
  collations?: {
    [column: string]: string;
  };
  nulls?: {
    [column: string]: 'FIRST' | 'LAST';
  };
  using?: 'btree' | 'hash' | 'gin' | 'gist';
  concurrently?: boolean;
  withParams?: Record<string, string | number | boolean>;
};
export declare class PgIndexBuilder {
  private readonly logger?;
  constructor(logger?: LoggerLike | undefined);
  buildCreateIndexSql(table: string, index: PgIndexSpec): string;
  private isValidIndexSpec;
  private warnIfCollationWithNonBtree;
  private buildIndexColumnsList;
  private buildWithParams;
  private formatIndexColumn;
  private buildUniqueKeyword;
  private buildConcurrently;
  private buildUsing;
  private buildWhere;
  private composeCreateIndexSql;
}
export {};
//# sourceMappingURL=PgIndexBuilder.d.ts.map
