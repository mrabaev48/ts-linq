import { DatabaseProvider } from '../providers/DatabaseProvider';

export interface TableColumnInfo {
    name: string;
    type: string;
    notnull: boolean;
    dflt_value: any;
    pk: number;
}

export interface TableInfo {
    name: string;
    columns: TableColumnInfo[];
}

/** Simple SQLite schema inspector using sqlite_master and PRAGMA table_info. */
export class SQLiteSchemaInspector {
    constructor(private provider: DatabaseProvider) {}

    public async listTables(): Promise<string[]> {
        const rows = await this.provider.executeQuery<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        );
        return rows.map(r => r.name);
    }

    public async getTableInfo(table: string): Promise<TableInfo> {
        const cols = await this.provider.executeQuery<TableColumnInfo>(`PRAGMA table_info(${table})`);
        return { name: table, columns: cols };
    }
}


