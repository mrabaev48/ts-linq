import { EntityMetadata, ColumnMetadata } from '@ts-linq/core';
export declare class MySqlDdlStrategy {
    generateCreateTableSql(metadata: EntityMetadata): string;
    generateCreateIndexSql(table: string, index: {
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
    }): string;
    generateColumnDefinition(column: ColumnMetadata): string;
    mapTypeToMySql(type: string): string;
}
//# sourceMappingURL=MySqlDdlStrategy.d.ts.map