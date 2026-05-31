export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  defaultExpression?: string;
  isPrimaryKey?: boolean;
  isComputed?: boolean;
  computedExpression?: string;
  computedStorage?: 'VIRTUAL' | 'STORED' | 'PERSISTED';
}

export interface IndexDef {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
  orders?: { [column: string]: 'ASC' | 'DESC' };
  collations?: { [column: string]: string };
  nulls?: { [column: string]: 'FIRST' | 'LAST' };
  expressions?: string[];
  using?: 'btree' | 'hash' | 'gin' | 'gist';
  concurrently?: boolean;
  withParams?: Record<string, string | number | boolean>;
  mysqlVisibility?: 'VISIBLE' | 'INVISIBLE';
  include?: string[];
}

export interface ForeignKeyDef {
  name?: string;
  columns: string[];
  refTable: string;
  refColumns: string[];
  onDelete?: string;
  onUpdate?: string;
}

export interface TableSnapshot {
  name: string;
  columns: ColumnDef[];
  primaryKeys: string[];
  indexes: IndexDef[];
  foreignKeys: ForeignKeyDef[];
}

export interface SchemaSnapshot {
  tables: TableSnapshot[];
}

export interface ColumnChange {
  kind: 'add' | 'alter' | 'drop';
  column: ColumnDef;
  prev?: ColumnDef;
}

export interface TableDiff {
  table: string;
  create?: TableSnapshot;
  drop?: boolean;
  /** Rename this table to a new name. */
  renameTo?: string;
  columnChanges?: ColumnChange[];
  /** Rename columns within an existing table. */
  columnRenames?: Array<{ from: string; to: string }>;
  /** Create these indexes on the existing table. */
  indexCreates?: IndexDef[];
  /** Drop these index names from the existing table. */
  indexDrops?: string[];
  /** Create these foreign keys on the existing table. */
  fkCreates?: ForeignKeyDef[];
  /** Drop these foreign key constraint names from the existing table. */
  fkDrops?: string[];
  // future: fkChanges
  /** Optional snapshot of expected columns after changes. */
  columnsAfter?: ColumnDef[];
  /** Optional snapshot of expected primary keys after changes. */
  primaryKeysAfter?: string[];
}

export interface SeedRowInsert {
  kind: 'insert';
  table: string;
  pkColumns: string[];
  row: Record<string, unknown>;
}

export interface SeedRowUpdate {
  kind: 'update';
  table: string;
  pkColumns: string[];
  row: Record<string, unknown>;
  /** Previous column values — used to generate reversible DOWN SQL. */
  prev: Record<string, unknown>;
}

export interface SeedRowDelete {
  kind: 'delete';
  table: string;
  pkColumns: string[];
  /** Full row needed for rollback INSERT. */
  row: Record<string, unknown>;
}

export type SeedRowOp = SeedRowInsert | SeedRowUpdate | SeedRowDelete;

export interface SchemaDiff {
  tables: TableDiff[];
  seedOps?: SeedRowOp[];
}

export interface MigrationSql {
  up: string[];
  down: string[];
}
