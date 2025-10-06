import type { EntityMetadata, ColumnMetadata } from '@ts-linq/core';
type LoggerLike = {
  warn(message: string, error?: unknown): void;
};
export declare class MySqlDdlStrategy {
  private readonly logger?;
  private readonly indexBuilder;
  constructor(logger?: LoggerLike | undefined);
  generateCreateTableSql(metadata: EntityMetadata): string;
  generateCreateIndexSql(
    table: string,
    index: {
      name: string;
      columns: string[];
      unique: boolean;
      where?: string;
      orders?: {
        [column: string]: 'ASC' | 'DESC';
      };
      expressions?: string[];
      nulls?: {
        [column: string]: 'FIRST' | 'LAST';
      };
      mysqlType?: 'FULLTEXT' | 'SPATIAL';
      mysqlVisibility?: 'VISIBLE' | 'INVISIBLE';
    }
  ): string;
  generateColumnDefinition(column: ColumnMetadata): string;
  mapTypeToMySql(type: string): string;
}
export {};
//# sourceMappingURL=MySqlDdlStrategy.d.ts.map
