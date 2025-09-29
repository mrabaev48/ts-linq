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
export declare class SQLiteSchemaInspector {
  private provider;
  constructor(provider: DatabaseProvider);
  listTables(): Promise<string[]>;
  getTableInfo(table: string): Promise<TableInfo>;
  getIndexes(table: string): Promise<TableIndexDef[]>;
}
/** PostgreSQL schema inspector using pg_catalog views. */
export declare class PostgresSchemaInspector {
  private provider;
  constructor(provider: DatabaseProvider);
  listTables(): Promise<string[]>;
  getIndexes(table: string): Promise<TableIndexDef[]>;
}
/** MySQL schema inspector using information_schema.statistics. */
export declare class MySqlSchemaInspector {
  private provider;
  constructor(provider: DatabaseProvider);
  listTables(): Promise<string[]>;
  getIndexes(table: string): Promise<TableIndexDef[]>;
}
/** MSSQL schema inspector using sys catalog views. */
export declare class MssqlSchemaInspector {
  private provider;
  constructor(provider: DatabaseProvider);
  listTables(): Promise<string[]>;
  getIndexes(table: string): Promise<TableIndexDef[]>;
}
//# sourceMappingURL=SchemaInspector.d.ts.map
