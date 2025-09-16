export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  isPrimaryKey?: boolean;
  length?: number;
  precision?: number;
  scale?: number;
}

export interface IndexDef {
  name: string;
  columns: string[];
  unique: boolean;
  expression?: string;
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

export interface UniqueConstraintDef {
  name?: string;
  columns: string[];
}

export interface TableSnapshot {
  name: string;
  columns: ColumnDef[];
  primaryKeys: string[];
  indexes: IndexDef[];
  foreignKeys: ForeignKeyDef[];
  uniqueConstraints?: UniqueConstraintDef[];
  checkConstraints?: Array<{ name?: string; expression: string }>;
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
  /** Final expected snapshot for this table (used for advanced strategies like SQLite rebuild). */
  finalSnapshot?: TableSnapshot;
  columnChanges?: ColumnChange[];
  /** Rename columns within an existing table. */
  columnRenames?: Array<{ from: string; to: string; toDef?: ColumnDef }>;
  /** Create these indexes on the existing table. */
  indexCreates?: IndexDef[];
  /** Drop these index names from the existing table. */
  indexDrops?: string[];
  /** Create these foreign keys on the existing table. */
  fkCreates?: ForeignKeyDef[];
  /** Drop these foreign key constraint names from the existing table. */
  fkDrops?: string[];
  /** Create these unique constraints on the existing table. */
  uniqueCreates?: UniqueConstraintDef[];
  /** Drop these unique constraint names from the existing table. */
  uniqueDrops?: string[];
  /** Rename unique constraints (by name) where columns match. */
  uniqueRenames?: Array<{ from: string; to: string }>;
  /** Create these check constraints. */
  checkCreates?: Array<{ name?: string; expression: string }>;
  /** Drop these check constraint names. */
  checkDrops?: string[];
  /** Rename check constraints (by name) where expression matches. */
  checkRenames?: Array<{ from: string; to: string }>;
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
        const lengthChanged =
          (expectedColumn as { length?: number }).length !==
          ((actualColumn as { length?: number }).length ?? undefined);
        const precisionChanged =
          (expectedColumn as { precision?: number }).precision !==
          ((actualColumn as { precision?: number }).precision ?? undefined);
        const scaleChanged =
          (expectedColumn as { scale?: number }).scale !==
          ((actualColumn as { scale?: number }).scale ?? undefined);
        // Compare by nullable flag when available in snapshot
        const nullableChanged =
          typeof (actualColumn as { nullable?: boolean }).nullable === 'boolean'
            ? expectedColumn.nullable !== (actualColumn as { nullable?: boolean }).nullable!
            : false;
        // Compare default value conservatively (normalize strings; ignore complex engine wrappers)
        const expectedDef = normalizeDefaultGeneric(
          (expectedColumn as { defaultValue?: unknown }).defaultValue
        );
        const actualDef = normalizeDefaultGeneric(
          (actualColumn as { defaultValue?: unknown }).defaultValue
        );
        const defaultChanged = expectedDef !== actualDef;
        const needsAlter =
          typeChanged ||
          nullableChanged ||
          defaultChanged ||
          lengthChanged ||
          precisionChanged ||
          scaleChanged;
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
    const tableDiff: TableDiff = { table: expectedTable.name, finalSnapshot: expectedTable };
    if (changes.length > 0) {
      // Detect potential renames: pair one drop with one add if shape matches
      const adds = changes.filter((c) => c.kind === 'add');
      const drops = changes.filter((c) => c.kind === 'drop');
      const renames: Array<{ from: string; to: string; toDef?: ColumnDef }> = [];
      const usedAdd = new Set<number>();
      const usedDrop = new Set<number>();
      for (let di = 0; di < drops.length; di += 1) {
        const d = drops[di];
        for (let ai = 0; ai < adds.length; ai += 1) {
          const a = adds[ai];
          if (usedAdd.has(ai)) continue;
          if (isSimilarColumn(a.column, d.column)) {
            renames.push({ from: d.column.name, to: a.column.name, toDef: a.column });
            usedAdd.add(ai);
            usedDrop.add(di);
            break;
          }
        }
      }
      // Filter out paired add/drop from changes
      const filtered = changes.filter((c) => {
        if (c.kind === 'add') {
          const idx = adds.indexOf(c);
          return !usedAdd.has(idx);
        }
        if (c.kind === 'drop') {
          const idx = drops.indexOf(c);
          return !usedDrop.has(idx);
        }
        return true;
      });
      if (filtered.length > 0) tableDiff.columnChanges = filtered;
      if (renames.length > 0) tableDiff.columnRenames = renames;
    }
    // Index diff: detect create/drop and changes (drop+create on option change)
    const actualIdxByName = new Map(
      (actualTable.indexes || []).map((i) => [i.name, normalizeIndex(i)] as const)
    );
    const expectedIdxByName = new Map(
      (expectedTable.indexes || []).map((i) => [i.name, normalizeIndex(i)] as const)
    );
    const idxCreates: IndexDef[] = [];
    const idxDrops: string[] = [];
    for (const idx of expectedTable.indexes || []) {
      const ai = actualIdxByName.get(idx.name);
      if (!ai) {
        idxCreates.push(idx);
      } else {
        const changed =
          idx.unique !== (ai as { unique?: boolean }).unique ||
          normalizeWhere(idx.where) !== normalizeWhere((ai as { where?: string }).where) ||
          normalizeExpr(idx.expression) !==
            normalizeExpr((ai as { expression?: string }).expression) ||
          normalizeColumns(idx.columns) !==
            normalizeColumns((ai as { columns?: string[] }).columns);
        if (changed) {
          idxDrops.push(idx.name);
          idxCreates.push(idx);
        }
      }
    }
    for (const ai of actualTable.indexes || []) {
      if (!expectedIdxByName.has(ai.name)) idxDrops.push(ai.name);
    }
    if (idxCreates.length > 0) tableDiff.indexCreates = idxCreates;
    if (idxDrops.length > 0) tableDiff.indexDrops = idxDrops;

    // FK diff (create, drop, and changes in actions/refs)
    const actualFkByName = new Map(
      (actualTable.foreignKeys || []).map(
        (f) => [f.name || `${f.columns.join('_')}__${f.refTable}`, f] as const
      )
    );
    const fkCreates: ForeignKeyDef[] = [];
    const fkDropsSet = new Set<string>();
    for (const fk of expectedTable.foreignKeys || []) {
      const key = fk.name || `${fk.columns.join('_')}__${fk.refTable}`;
      const af = actualFkByName.get(key);
      if (!af) {
        fkCreates.push(fk);
      } else {
        const actionsChanged =
          (fk.onDelete || '').toUpperCase() !==
            ((af as { onDelete?: string }).onDelete || '').toUpperCase() ||
          (fk.onUpdate || '').toUpperCase() !==
            ((af as { onUpdate?: string }).onUpdate || '').toUpperCase();
        const refColsChanged =
          (fk.refColumns || []).join(',') !==
          ((af as { refColumns?: string[] }).refColumns || []).join(',');
        const colsChanged =
          (fk.columns || []).join(',') !== ((af as { columns?: string[] }).columns || []).join(',');
        if (actionsChanged || refColsChanged || colsChanged) {
          fkDropsSet.add((af as { name?: string }).name || key);
          fkCreates.push(fk);
        }
      }
    }
    if (fkCreates.length > 0) tableDiff.fkCreates = fkCreates;
    // Unique constraints diff
    const expectedUniqByName = new Map(
      (expectedTable.uniqueConstraints || []).map(
        (u) => [u.name || u.columns.join('__'), u] as const
      )
    );
    const actualUniqByName = new Map(
      (actualTable.uniqueConstraints || []).map((u) => [u.name || u.columns.join('__'), u] as const)
    );
    const uniqueCreates: UniqueConstraintDef[] = [];
    const uniqueRenames: Array<{ from: string; to: string }> = [];
    for (const [key, u] of expectedUniqByName) {
      if (!actualUniqByName.has(key)) {
        const match = (actualTable.uniqueConstraints || []).find(
          (au) => (au.columns || []).join('__') === (u.columns || []).join('__')
        );
        if (match && match.name && u.name && match.name !== u.name) {
          uniqueRenames.push({ from: match.name, to: u.name });
        } else {
          uniqueCreates.push(u);
        }
      }
    }
    const uniqueDrops: string[] = [];
    const renamedFrom = new Set<string>((uniqueRenames || []).map((r) => r.from));
    for (const [key, u] of actualUniqByName) {
      const name = u.name || key;
      if (renamedFrom.has(name)) continue; // skip drop for renamed unique
      if (!expectedUniqByName.has(key)) uniqueDrops.push(name);
    }
    if (uniqueCreates.length > 0) tableDiff.uniqueCreates = uniqueCreates;
    if (uniqueDrops.length > 0) tableDiff.uniqueDrops = uniqueDrops;
    if (uniqueRenames.length > 0) tableDiff.uniqueRenames = uniqueRenames;

    // CHECK constraints diff (normalize expressions to reduce noise)
    const expectedChecks = (expectedTable.checkConstraints || []).map((c) => ({
      name: c.name,
      expression: normalizeCheckExpr(c.expression)
    }));
    const actualChecks = (actualTable.checkConstraints || []).map((c) => ({
      name: c.name,
      expression: normalizeCheckExpr(c.expression)
    }));
    const actualCheckByKey = new Map(actualChecks.map((c) => [c.name || c.expression, c] as const));
    const checkCreates: Array<{ name?: string; expression: string }> = [];
    const checkRenames: Array<{ from: string; to: string }> = [];
    for (const ec of expectedChecks) {
      const key = ec.name || ec.expression;
      if (!actualCheckByKey.has(key)) {
        const match = (actualChecks || []).find((ac) => ac.expression === ec.expression);
        if (match && match.name && ec.name && match.name !== ec.name) {
          checkRenames.push({ from: match.name, to: ec.name });
        } else {
          checkCreates.push(ec);
        }
      }
    }
    const expectedCheckByKey = new Map(
      expectedChecks.map((c) => [c.name || c.expression, c] as const)
    );
    const checkDrops: string[] = [];
    const renamedCheckFrom = new Set<string>((checkRenames || []).map((r) => r.from));
    for (const ac of actualChecks) {
      const key = ac.name || ac.expression;
      if (renamedCheckFrom.has(ac.name || '')) continue; // skip drop for renamed check
      if (!expectedCheckByKey.has(key)) checkDrops.push(ac.name || ac.expression);
    }
    if (checkCreates.length > 0) tableDiff.checkCreates = checkCreates;
    if (checkDrops.length > 0) tableDiff.checkDrops = checkDrops;
    if (checkRenames.length > 0) tableDiff.checkRenames = checkRenames;
    // FK drops (exist in actual but not in expected)
    const expectedFkByName = new Map(
      (expectedTable.foreignKeys || []).map(
        (f) => [f.name || `${f.columns.join('_')}__${f.refTable}`, f] as const
      )
    );
    const fkDrops: string[] = [];
    for (const af of actualTable.foreignKeys || []) {
      const key = af.name || `${af.columns.join('_')}__${af.refTable}`;
      if (!expectedFkByName.has(key)) fkDrops.push(af.name || key);
    }
    for (const name of fkDropsSet) fkDrops.push(name);
    if (fkDrops.length > 0) tableDiff.fkDrops = fkDrops;

    if (
      tableDiff.columnChanges ||
      tableDiff.indexCreates ||
      tableDiff.indexDrops ||
      tableDiff.fkCreates ||
      tableDiff.fkDrops ||
      tableDiff.uniqueCreates ||
      tableDiff.uniqueDrops ||
      tableDiff.uniqueRenames ||
      tableDiff.checkCreates ||
      tableDiff.checkDrops ||
      tableDiff.checkRenames
    ) {
      diffs.push(tableDiff);
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

function normalizeCheckExpr(expr: string): string {
  const s = String(expr || '')
    .trim()
    .replace(/^CHECK\s*\((.*)\)$/i, '$1')
    // remove casts ::type
    .replace(/::[A-Z0-9_]+/gi, '')
    // strip quotes around identifiers
    .replace(/"([^"]+)"/g, '$1')
    // remove redundant parentheses
    .replace(/^\((.*)\)$/, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s*([=<>+\-*/(),])\s*/g, '$1')
    .toUpperCase()
    // boolean normalization
    .replace(/=TRUE/g, '=1')
    .replace(/=FALSE/g, '=0');
  return s;
}

function normalizeDefaultGeneric(v: unknown): string {
  if (v === undefined) return '';
  if (v === null) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  let s = String(v).trim();
  // Normalize string literal prefixes: MSSQL N'..', Postgres E'..'
  s = s.replace(/^N'/i, "'").replace(/^E'/i, "'");
  // Strip surrounding quotes
  const unq = s.replace(/^'+|'+$/g, '');
  // Remove PostgreSQL casts ::type and redundant parentheses
  const noCast = unq.replace(/::[A-Z0-9_]+/gi, '');
  let noParens = noCast.replace(/^\((.*)\)$/, '$1').replace(/^\((.*)\)$/, '$1');
  let up = noParens.trim().toUpperCase();
  // Normalize common timestamp functions across dialects
  if (
    up === 'NOW()' ||
    up === 'GETDATE()' ||
    up === 'SYSDATETIME()' ||
    up === 'CURRENT_TIMESTAMP()' ||
    up === 'LOCALTIME()' ||
    up === 'LOCALTIMESTAMP()' ||
    up === 'CLOCK_TIMESTAMP()' ||
    up === 'STATEMENT_TIMESTAMP()' ||
    up === 'TRANSACTION_TIMESTAMP()'
  )
    up = 'CURRENT_TIMESTAMP';
  // Normalize boolean defaults across dialects
  if (up === '0' || up === 'FALSE') up = 'FALSE';
  if (up === '1' || up === 'TRUE') up = 'TRUE';
  if (up === 'T') up = 'TRUE';
  if (up === 'F') up = 'FALSE';
  // Normalize MySQL CURRENT_TIMESTAMP with precision
  up = up.replace(/^CURRENT_TIMESTAMP\(\d+\)$/i, 'CURRENT_TIMESTAMP');
  // Normalize CURRENT_DATE/TIME variants
  up = up.replace(/^CURRENT_DATE\(\d*\)$/i, 'CURRENT_DATE');
  up = up.replace(/^CURRENT_TIME\(\d+\)$/i, 'CURRENT_TIME');
  if (up === 'LOCALTIME') up = 'CURRENT_TIME';
  if (up === 'LOCALTIMESTAMP') up = 'CURRENT_TIMESTAMP';
  // MSSQL GETUTCDATE -> map to CURRENT_TIMESTAMP for comparison
  if (up === 'GETUTCDATE()') up = 'CURRENT_TIMESTAMP';
  // Normalize UUID generators across dialects
  if (
    up === 'GEN_RANDOM_UUID()' ||
    up === 'UUID_GENERATE_V4()' ||
    up === 'UUID()' ||
    up === 'NEWID()' ||
    up === 'NEWSEQUENTIALID()'
  )
    up = 'UUID';
  // Normalize Postgres nextval casting patterns
  up = up.replace(/NEXTVAL\(\s*'([^']+)'::[A-Z0-9_]+\s*\)/i, "NEXTVAL('$1')");
  // Normalize function schema qualifiers e.g., pg_catalog.now() -> NOW()
  up = up.replace(/^[A-Z_]+\.[A-Z_]+\(\)/i, (m) => m.replace(/^[A-Z_]+\./i, '').toUpperCase());
  return up;
}

function isSimilarColumn(a: ColumnDef, b: ColumnDef): boolean {
  const typeEq = normalizeType(a.type) === normalizeType((b as { type?: string }).type || '');
  const nullableEq = a.nullable === ((b as { nullable?: boolean }).nullable ?? a.nullable);
  const defEq =
    normalizeDefaultGeneric(a.defaultValue) ===
    normalizeDefaultGeneric((b as { defaultValue?: unknown }).defaultValue);
  const lenEq =
    (a as { length?: number }).length === ((b as { length?: number }).length ?? undefined);
  const precEq =
    (a as { precision?: number }).precision ===
    ((b as { precision?: number }).precision ?? undefined);
  const scaleEq =
    (a as { scale?: number }).scale === ((b as { scale?: number }).scale ?? undefined);
  return typeEq && nullableEq && defEq && lenEq && precEq && scaleEq;
}

function normalizeWhere(where?: string): string {
  if (!where) return '';
  return normalizeExpr(where);
}

function normalizeColumns(cols?: string[]): string {
  if (!cols || cols.length === 0) return '';
  return cols.map((c) => c.replace(/"/g, '').trim().toLowerCase()).join(',');
}

function normalizeExpr(expr?: string): string {
  if (!expr) return '';
  return String(expr)
    .trim()
    .replace(/"([^"]+)"/g, '$1')
    .replace(/::[A-Z0-9_]+/gi, '')
    .replace(/^\((.*)\)$/, '$1')
    .replace(/^\((.*)\)$/, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s*([=<>+\-*/(),])\s*/g, '$1')
    .toLowerCase();
}

function normalizeIndex(idx: IndexDef): IndexDef {
  return {
    ...idx,
    columns: (idx.columns || []).map((c) => c.replace(/"/g, '').trim().toLowerCase()),
    where: normalizeWhere(idx.where),
    expression: normalizeExpr(idx.expression)
  };
}
