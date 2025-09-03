export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  isPrimaryKey?: boolean;
}

export interface IndexDef {
  name: string;
  columns: string[];
  unique: boolean;
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
  columnChanges?: ColumnChange[];
  // future: indexChanges, fkChanges
}

export interface SchemaDiff {
  tables: TableDiff[];
}

export function compareSchemas(expected: SchemaSnapshot, actual: SchemaSnapshot): SchemaDiff {
  const diffs: TableDiff[] = [];
  const actualByName = new Map(actual.tables.map((t) => [t.name, t] as const));
  const expectedNames = new Set(expected.tables.map((t) => t.name));

  // New or altered tables
  for (const expectedTable of expected.tables) {
    const actualTable = actualByName.get(expectedTable.name);
    if (!actualTable) {
      diffs.push({ table: expectedTable.name, create: expectedTable });
      continue;
    }
    const changes: ColumnChange[] = [];
    const actualColsByName = new Map(actualTable.columns.map((c) => [c.name, c] as const));
    for (const expectedColumn of expectedTable.columns) {
      const actualColumn = actualColsByName.get(expectedColumn.name);
      if (!actualColumn) {
        changes.push({ kind: 'add', column: expectedColumn });
      } else {
        const typeChanged =
          normalizeType(expectedColumn.type) !== normalizeType((actualColumn as any).type);
        // Compare by nullable flag when available in snapshot
        const nullableChanged =
          typeof (actualColumn as any).nullable === 'boolean'
            ? expectedColumn.nullable !== (actualColumn as any).nullable
            : false;
        const needsAlter = typeChanged || nullableChanged;
        if (needsAlter) {
          changes.push({ kind: 'alter', column: expectedColumn, prev: actualColumn });
        }
      }
    }
    // Drops
    const expectedColsByName = new Map(expectedTable.columns.map((c) => [c.name, c] as const));
    for (const actualColumn of actualTable.columns) {
      if (!expectedColsByName.has(actualColumn.name)) {
        changes.push({ kind: 'drop', column: actualColumn });
      }
    }
    if (changes.length > 0) diffs.push({ table: expectedTable.name, columnChanges: changes });
  }
  // Dropped tables
  const expectedByName = new Map(expected.tables.map((table) => [table.name, table] as const));
  for (const actualTable of actual.tables) {
    if (!expectedByName.has(actualTable.name)) {
      diffs.push({ table: actualTable.name, drop: true });
    }
  }
  return { tables: diffs };
}

function normalizeType(t: string): string {
  return String(t || '')
    .trim()
    .toUpperCase();
}
