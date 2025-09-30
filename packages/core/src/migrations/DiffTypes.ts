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
  /** Optional snapshot of expected columns after changes (used for SQLite rebuild). */
  columnsAfter?: ColumnDef[];
  /** Optional snapshot of expected primary keys after changes (used for SQLite rebuild). */
  primaryKeysAfter?: string[];
}

export interface SchemaDiff {
  tables: TableDiff[];
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

function diffColumns(expectedTable: TableSnapshot, actualTable: TableSnapshot): ColumnChange[] {
  const changes: ColumnChange[] = [];
  const actualColsByName = new Map(actualTable.columns.map((c) => [c.name, c] as const));
  for (const expectedColumn of expectedTable.columns) {
    const actualColumn = actualColsByName.get(expectedColumn.name);
    if (!actualColumn) {
      changes.push({ kind: 'add', column: expectedColumn });
      continue;
    }
    if (isColumnAltered(expectedColumn, actualColumn)) {
      changes.push({ kind: 'alter', column: expectedColumn, prev: actualColumn });
    }
  }
  // Drops
  const expectedColsByName = new Map(expectedTable.columns.map((c) => [c.name, c] as const));
  for (const actualColumn of actualTable.columns) {
    if (!expectedColsByName.has(actualColumn.name))
      changes.push({ kind: 'drop', column: actualColumn });
  }
  return changes;
}

function isColumnAltered(expectedColumn: ColumnDef, actualColumn: ColumnDef): boolean {
  const typeChanged =
    normalizeType(expectedColumn.type) !==
    normalizeType((actualColumn as { type?: string }).type ?? '');
  const nullableChanged =
    typeof (actualColumn as { nullable?: boolean }).nullable === 'boolean'
      ? expectedColumn.nullable !== (actualColumn as { nullable?: boolean }).nullable!
      : false;
  const expectedIsComputed = !!(expectedColumn as { isComputed?: boolean }).isComputed;
  const actualIsComputed = !!(actualColumn as { isComputed?: boolean }).isComputed;
  const expectedExpr = (expectedColumn as { computedExpression?: string }).computedExpression;
  const actualExpr = (actualColumn as { computedExpression?: string }).computedExpression;
  const expectedStorage = (expectedColumn as { computedStorage?: string }).computedStorage;
  const actualStorage = (actualColumn as { computedStorage?: string }).computedStorage;
  const computedChanged =
    expectedIsComputed !== actualIsComputed ||
    (expectedExpr || '') !== (actualExpr || '') ||
    (expectedStorage || '') !== (actualStorage || '');
  const defaultExprChanged =
    ((expectedColumn as { defaultExpression?: string }).defaultExpression || '') !==
    ((actualColumn as unknown as ColumnDef).defaultExpression || '');
  return typeChanged || nullableChanged || computedChanged || defaultExprChanged;
}

function diffIndexes(
  expectedTable: TableSnapshot,
  actualTable: TableSnapshot
): {
  creates: IndexDef[];
  drops: string[];
} {
  const creates: IndexDef[] = [];
  const drops: string[] = [];
  const expIdxByName = new Map(expectedTable.indexes.map((i) => [i.name, i] as const));
  const actIdxByName = new Map(actualTable.indexes.map((i) => [i.name, i] as const));
  for (const [name, expIdx] of expIdxByName) {
    const actIdx = actIdxByName.get(name);
    const equal = isIndexEqual(expIdx, actIdx);
    if (!actIdx || !equal) {
      if (actIdx && !equal) drops.push(name);
      creates.push(expIdx);
    }
  }
  for (const [name] of actIdxByName) {
    if (!expIdxByName.has(name)) drops.push(name);
  }
  return { creates, drops };
}

function isIndexEqual(expIdx: IndexDef, actIdx: IndexDef | undefined): boolean {
  if (!actIdx) return false;
  if (!arraysEqual(expIdx.columns, actIdx.columns)) return false;
  if (!!expIdx.unique !== !!actIdx.unique) return false;
  if ((expIdx.where || '') !== ((actIdx as { where?: string }).where || '')) return false;
  const actOrders = (actIdx as { orders?: Record<string, 'ASC' | 'DESC'> }).orders;
  const actCollations = (actIdx as { collations?: Record<string, string> }).collations;
  const actNulls = (actIdx as { nulls?: Record<string, 'FIRST' | 'LAST'> }).nulls;
  const expExpressions = expIdx.expressions || [];
  const actExpressions = (actIdx as { expressions?: string[] }).expressions || [];
  if (!shallowObjEqual(expIdx.orders, actOrders)) return false;
  if (!shallowObjEqual(expIdx.collations, actCollations)) return false;
  if (!shallowObjEqual(expIdx.nulls, actNulls)) return false;
  if (!arraysEqual(expExpressions, actExpressions)) return false;
  return true;
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

function shallowObjEqual<T extends Record<string, unknown> | undefined>(a: T, b: T): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}
