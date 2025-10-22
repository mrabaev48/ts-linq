import type { EntityMetadata, ColumnMetadata } from '@ts-linq/core';
type LoggerLike = {
    warn(message: string, error?: unknown): void;
};
export declare class MssqlDdlStrategy {
    private readonly logger?;
    private readonly indexBuilder;
    constructor(logger?: LoggerLike | undefined);
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
export {};
//# sourceMappingURL=MssqlDdlStrategy.d.ts.map