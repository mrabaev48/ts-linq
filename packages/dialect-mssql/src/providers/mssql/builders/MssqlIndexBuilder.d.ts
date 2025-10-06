type LoggerLike = {
  warn(message: string, error?: unknown): void;
};
export type MssqlIndexSpec = {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
  orders?: {
    [column: string]: 'ASC' | 'DESC';
  };
  include?: string[];
  expressions?: string[];
  collations?: {
    [column: string]: string;
  };
  nulls?: {
    [column: string]: 'FIRST' | 'LAST';
  };
};
export declare class MssqlIndexBuilder {
  private readonly logger?;
  constructor(logger?: LoggerLike | undefined);
  buildCreateIndexSql(table: string, index: MssqlIndexSpec): string;
  private isValid;
  private warnUnsupported;
}
export {};
//# sourceMappingURL=MssqlIndexBuilder.d.ts.map
