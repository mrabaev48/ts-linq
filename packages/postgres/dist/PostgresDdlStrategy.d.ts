import { EntityMetadata } from '@ts-linq/core';
export declare class PostgresDdlStrategy {
    generateCreateTableSql(entityMetadata: EntityMetadata): string;
    generateCreateIndexSql(table: string, index: {
        name: string;
        columns: string[];
        unique: boolean;
    }): string;
    mapTypeToPg(type: string): string;
}
//# sourceMappingURL=PostgresDdlStrategy.d.ts.map