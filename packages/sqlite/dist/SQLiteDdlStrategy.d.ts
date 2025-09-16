import { EntityMetadata, ColumnMetadata } from '@ts-linq/core';
export declare class SQLiteDdlStrategy {
    generateCreateTableSql(metadata: EntityMetadata): string;
    generateCreateIndexSql(tableName: string, index: {
        name: string;
        columns: string[];
        unique: boolean;
    }): string;
    generateColumnDefinition(column: ColumnMetadata): string;
    mapTypeToSQLite(type: string): string;
}
//# sourceMappingURL=SQLiteDdlStrategy.d.ts.map