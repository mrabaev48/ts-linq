export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  isPrimaryKey?: boolean;
}

export interface IndexDef {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
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
          normalizeType(expectedColumn.type) !==
          normalizeType((actualColumn as { type?: string }).type ?? '');
        // Compare by nullable flag when available in snapshot
        const nullableChanged =
          typeof (actualColumn as { nullable?: boolean }).nullable === 'boolean'
            ? expectedColumn.nullable !== (actualColumn as { nullable?: boolean }).nullable!
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
    // Index diffs
    const indexCreates: IndexDef[] = [];
    const indexDrops: string[] = [];
    const expIdxByName = new Map(expectedTable.indexes.map((i) => [i.name, i] as const));
    const actIdxByName = new Map(actualTable.indexes.map((i) => [i.name, i] as const));
    for (const [name, expIdx] of expIdxByName) {
      const actIdx = actIdxByName.get(name);
      const equal = actIdx
        ? arraysEqual(expIdx.columns, actIdx.columns) && !!expIdx.unique === !!actIdx.unique && (expIdx.where || '') === ((actIdx as { where?: string }).where || '')
        : false;
      if (!actIdx || !equal) {
        if (actIdx && !equal) indexDrops.push(name);
        indexCreates.push(expIdx);
      }
    }
    for (const [name] of actIdxByName) {
      if (!expIdxByName.has(name)) indexDrops.push(name);
    }
    if (changes.length > 0 || indexCreates.length > 0 || indexDrops.length > 0) {
      diffs.push({ table: expectedTable.name, columnChanges: changes.length ? changes : undefined, indexCreates: indexCreates.length ? indexCreates : undefined, indexDrops: indexDrops.length ? indexDrops : undefined });
    }
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

function normalizeType(typeName: string): string {
  return String(typeName || '')
    .trim()
    .toUpperCase();
}

function arraysEqual(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
