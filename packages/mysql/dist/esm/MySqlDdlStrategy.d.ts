import { EntityMetadata, ColumnMetadata } from '@ts-linq/core';
export declare class MySqlDdlStrategy {
    generateCreateTableSql(metadata: EntityMetadata): string;
    generateCreateIndexSql(table: string, index: {
        name: string;
        columns: string[];
        unique: boolean;
    }): string;
    generateColumnDefinition(column: ColumnMetadata): string;
    mapTypeToMySql(type: string): string;
}
//# sourceMappingURL=MySqlDdlStrategy.d.ts.map