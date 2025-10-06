import type { EntityMetadata, ColumnMetadata } from '@ts-linq/core';
type LoggerLike = {
  warn(message: string, error?: unknown): void;
};
export declare class SQLiteDdlStrategy {
  private readonly logger?;
  private readonly indexBuilder;
  constructor(logger?: LoggerLike | undefined);
  generateCreateTableSql(metadata: EntityMetadata): string;
  generateCreateIndexSql(
    tableName: string,
    index: {
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
    }
  ): string;
  generateColumnDefinition(column: ColumnMetadata): string;
  mapTypeToSQLite(type: string): string;
}
export {};
//# sourceMappingURL=SQLiteDdlStrategy.d.ts.map
