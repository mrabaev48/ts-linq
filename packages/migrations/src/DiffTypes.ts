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

export interface SchemaDiff {
  tables: TableDiff[];
}

export interface MigrationSql {
  up: string[];
  down: string[];
}

export function compareSchemas(expected: SchemaSnapshot, actual: SchemaSnapshot): SchemaDiff {
  const diffs: TableDiff[] = [];
  const actualByName = new Map(actual.tables.map((t) => [t.name, t] as const));

  for (const expectedTable of expected.tables) {
    const actualTable = actualByName.get(expectedTable.name);
    if (!actualTable) {
      diffs.push({ table: expectedTable.name, create: expectedTable });
      continue;
    }
    const diff = diffExistingTable(expectedTable, actualTable);
    if (diff) diffs.push(diff);
  }

  // Dropped tables
  const expectedByName = new Map(expected.tables.map((t) => [t.name, t] as const));
  for (const actualTable of actual.tables) {
    if (!expectedByName.has(actualTable.name)) diffs.push({ table: actualTable.name, drop: true });
  }
  return { tables: diffs };
}

function diffExistingTable(
  expectedTable: TableSnapshot,
  actualTable: TableSnapshot
): TableDiff | null {
  const { diffColumns } = require('./comparators/ColumnComparator');
  const { diffIndexes } = require('./comparators/IndexComparator');
  const columnChanges = diffColumns(expectedTable, actualTable);
  const { creates: indexCreates, drops: indexDrops } = diffIndexes(expectedTable, actualTable);
  if (columnChanges.length === 0 && indexCreates.length === 0 && indexDrops.length === 0) {
    return null;
  }
  return {
    table: expectedTable.name,
    columnChanges: columnChanges.length ? columnChanges : undefined,
    indexCreates: indexCreates.length ? indexCreates : undefined,
    indexDrops: indexDrops.length ? indexDrops : undefined
  };
}
