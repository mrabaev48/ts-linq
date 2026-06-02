// Database-First scaffolding types (P2-43)

export interface DatabaseColumnModel {
  name: string;
  dbType: string;
  ormType: string;
  nullable: boolean;
  isPrimary: boolean;
  isIdentity: boolean;
  defaultExpression?: string;
}

export interface DatabaseForeignKeyModel {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: string;
}

export interface DatabaseIndexModel {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
}

export interface DatabaseTableModel {
  name: string;
  schema?: string;
  columns: DatabaseColumnModel[];
  primaryKeys: string[];
  foreignKeys: DatabaseForeignKeyModel[];
  indexes: DatabaseIndexModel[];
}

export interface DatabaseModel {
  tables: DatabaseTableModel[];
}

export interface DbIntrospector {
  introspect(schema?: string): Promise<DatabaseModel>;
}

export type ScaffoldProviderKind = 'postgres' | 'mysql' | 'mssql';

/** Options for the scaffoldDbContext function (connection management is caller's responsibility). */
export interface ScaffoldOptions {
  outputDir: string;
  contextName?: string;
  useDatabaseNames?: boolean;
  pluralize?: boolean;
  schema?: string;
  tables?: string[];
}

/** Full options including connection details — used by CLI and convenience wrappers. */
export interface ScaffoldConnectionOptions extends ScaffoldOptions {
  connection: string;
  provider: ScaffoldProviderKind;
}
