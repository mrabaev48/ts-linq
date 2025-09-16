import { EntityMetadata, ColumnMetadata } from '@ts-linq/core';
export declare class MssqlDdlStrategy {
    generateCreateTableSql(metadata: EntityMetadata): string;
    generateColumnDefinition(column: ColumnMetadata): string;
    generateCreateIndexSql(tableName: string, index: {
        name: string;
        columns: string[];
        unique: boolean;
    }): string;
    mapTypeToMssql(type: string): string;
}
//# sourceMappingURL=MssqlDdlStrategy.d.ts.map