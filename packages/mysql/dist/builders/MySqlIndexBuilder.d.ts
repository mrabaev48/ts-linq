type LoggerLike = {
    warn(message: string, error?: unknown): void;
};
export type MySqlIndexSpec = {
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
};
export declare class MySqlIndexBuilder {
    private readonly logger?;
    constructor(logger?: LoggerLike | undefined);
    buildCreateIndexSql(table: string, index: MySqlIndexSpec): string;
    private isValidIndexSpec;
    private warnUnsupportedOptions;
    private buildKind;
    private buildColumnsList;
}
export {};
//# sourceMappingURL=MySqlIndexBuilder.d.ts.map