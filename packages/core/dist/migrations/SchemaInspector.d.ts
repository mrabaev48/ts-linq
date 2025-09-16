import type { DatabaseProvider } from '../DatabaseProvider';
export interface TableColumnInfo {
    name: string;
    type: string;
    notnull: boolean;
    dflt_value: unknown;
    pk: number;
}
export interface TableInfo {
    name: string;
    columns: TableColumnInfo[];
}
/** Simple SQLite schema inspector using sqlite_master and PRAGMA table_info. */
export declare class SQLiteSchemaInspector {
    private provider;
    constructor(provider: DatabaseProvider);
    listTables(): Promise<string[]>;
    getTableInfo(table: string): Promise<TableInfo>;
}
//# sourceMappingURL=SchemaInspector.d.ts.map