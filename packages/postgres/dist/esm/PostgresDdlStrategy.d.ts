import { EntityMetadata } from '@ts-linq/core';
export declare class PostgresDdlStrategy {
  generateCreateTableSql(entityMetadata: EntityMetadata): string;
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
      collations?: {
        [column: string]: string;
      };
      nulls?: {
        [column: string]: 'FIRST' | 'LAST';
      };
      using?: 'btree' | 'hash' | 'gin' | 'gist';
      concurrently?: boolean;
      withParams?: Record<string, string | number | boolean>;
    }
  ): string;
  mapTypeToPg(type: string): string;
}
//# sourceMappingURL=PostgresDdlStrategy.d.ts.map
