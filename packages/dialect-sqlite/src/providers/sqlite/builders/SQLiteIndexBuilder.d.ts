type LoggerLike = {
  warn(message: string, error?: unknown): void;
};
export type SQLiteIndexSpec = {
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
};
export declare class SQLiteIndexBuilder {
  private readonly _logger?;
  constructor(_logger?: LoggerLike | undefined);
  buildCreateIndexSql(table: string, index: SQLiteIndexSpec): string;
}
export {};
//# sourceMappingURL=SQLiteIndexBuilder.d.ts.map
