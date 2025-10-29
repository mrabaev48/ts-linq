import type { EntityMetadata } from '@ts-linq/types';
type LoggerLike = {
    warn(message: string, error?: unknown): void;
};
export declare class PostgresDdlStrategy {
    private readonly logger?;
    private readonly indexBuilder;
    constructor(logger?: LoggerLike | undefined);
    generateCreateTableSql(entityMetadata: EntityMetadata): string;
    generateCreateIndexSql(table: string, index: {
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
    }): string;
    mapTypeToPg(type: string): string;
}
export {};
//# sourceMappingURL=PostgresDdlStrategy.d.ts.map