import { EntityMetadata, ColumnMetadata } from '@ts-linq/core';
export declare class MssqlDdlStrategy {
    generateCreateTableSql(metadata: EntityMetadata): string;
    generateColumnDefinition(column: ColumnMetadata): string;
    generateCreateIndexSql(tableName: string, index: {
        name: string;
        columns: string[];
        unique: boolean;
        where?: string;
        orders?: {
            [column: string]: 'ASC' | 'DESC';
        };
        include?: string[];
    }): string;
    mapTypeToMssql(type: string): string;
}
//# sourceMappingURL=MssqlDdlStrategy.d.ts.map