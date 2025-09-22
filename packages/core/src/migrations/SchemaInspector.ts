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

export interface TableIndexDef {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
}

/** Simple SQLite schema inspector using sqlite_master and PRAGMA table_info. */
export class SQLiteSchemaInspector {
  constructor(private provider: DatabaseProvider) {}

  public async listTables(): Promise<string[]> {
    const rows = await this.provider.executeQuery<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    return rows.map((r) => r.name);
  }

  public async getTableInfo(table: string): Promise<TableInfo> {
    const cols = await this.provider.executeQuery<TableColumnInfo>(`PRAGMA table_info(${table})`);
    return { name: table, columns: cols };
  }

  public async getIndexes(table: string): Promise<TableIndexDef[]> {
    const list = await this.provider.executeQuery<{ name: string; unique: 0 | 1; origin: string; partial: 0 | 1 }>(
      `PRAGMA index_list(${table})`
    );
    const result: TableIndexDef[] = [];
    for (const row of list) {
      const cols = await this.provider.executeQuery<{ name: string }>(`PRAGMA index_info(${row.name})`);
      const sqlRows = await this.provider.executeQuery<{ sql: string | null }>(
        `SELECT sql FROM sqlite_master WHERE type='index' AND name='${row.name}'`
      );
      const sql = sqlRows[0]?.sql || null;
      const where = extractWhereClause(sql || undefined);
      result.push({ name: row.name, columns: cols.map((c) => c.name), unique: !!row.unique, where: where || undefined });
    }
    return result;
  }
}

function extractWhereClause(sql?: string): string | null {
  if (!sql) return null;
  const m = /\sWHERE\s+(.+)$/i.exec(sql.trim());
  return m ? m[1] : null;
}
