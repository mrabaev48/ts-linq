import { SnapshotValidationError } from '@ts-linq/types';

import type { SeedRowOp } from '../DiffTypes';
import type { ModelTableSnapshot } from '../snapshot/model-snapshot';

function pkKey(row: Record<string, unknown>, pkColumns: string[]): string {
  return pkColumns.map((col) => String(row[col] ?? '')).join('\x00');
}

function rowsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function validatePkPresent(
  row: Record<string, unknown>,
  pkColumns: string[],
  tableName: string
): void {
  const missing = pkColumns.filter((col) => row[col] === undefined || row[col] === null);
  if (missing.length > 0) {
    throw new SnapshotValidationError(
      `hasData(): seed row in table '${tableName}' is missing primary key column(s): ${missing.join(', ')}. ` +
        `All seed rows must have explicit, stable primary key values.`,
      { details: { table: tableName, missingColumns: missing } }
    );
  }
}

/**
 * Diffs seed data between two ModelSnapshot table lists.
 * Returns INSERT / UPDATE / DELETE operations needed to transition from prev to current.
 */
export function diffSeeds(prev: ModelTableSnapshot[], current: ModelTableSnapshot[]): SeedRowOp[] {
  const ops: SeedRowOp[] = [];

  const prevByName = new Map(prev.map((t) => [t.name, t]));
  const currentByName = new Map(current.map((t) => [t.name, t]));

  for (const currentTable of current) {
    const prevTable = prevByName.get(currentTable.name);
    const pkColumns = currentTable.primaryKeys;

    if (!currentTable.seedData?.length) {
      // Seed rows removed entirely — emit deletes for everything in prev
      if (prevTable?.seedData?.length) {
        for (const row of prevTable.seedData) {
          validatePkPresent(row, pkColumns, currentTable.name);
          ops.push({ kind: 'delete', table: currentTable.name, pkColumns, row });
        }
      }
      continue;
    }

    const prevRows = prevTable?.seedData ?? [];
    const prevByPk = new Map(
      prevRows.map((r) => {
        validatePkPresent(r, pkColumns, currentTable.name);
        return [pkKey(r, pkColumns), r];
      })
    );

    for (const row of currentTable.seedData) {
      validatePkPresent(row, pkColumns, currentTable.name);
      const key = pkKey(row, pkColumns);
      const existing = prevByPk.get(key);
      if (!existing) {
        ops.push({ kind: 'insert', table: currentTable.name, pkColumns, row });
      } else if (!rowsEqual(row, existing)) {
        ops.push({ kind: 'update', table: currentTable.name, pkColumns, row, prev: existing });
      }
    }

    // Rows present in prev but missing in current → delete
    const currentByPk = new Map(currentTable.seedData.map((r) => [pkKey(r, pkColumns), r]));
    for (const prevRow of prevRows) {
      const key = pkKey(prevRow, pkColumns);
      if (!currentByPk.has(key)) {
        ops.push({ kind: 'delete', table: currentTable.name, pkColumns, row: prevRow });
      }
    }
  }

  // Tables removed from current entirely
  for (const prevTable of prev) {
    if (!currentByName.has(prevTable.name) && prevTable.seedData?.length) {
      const pkColumns = prevTable.primaryKeys;
      for (const row of prevTable.seedData) {
        ops.push({ kind: 'delete', table: prevTable.name, pkColumns, row });
      }
    }
  }

  return ops;
}

/**
 * Topologically sorts seed INSERT operations so that rows in referenced tables
 * come before rows in tables that depend on them. DELETE operations are reversed.
 *
 * fkGraph: table name → array of table names this table references (depends on).
 */
export function topoSortSeedOps(ops: SeedRowOp[], fkGraph: Map<string, string[]>): SeedRowOp[] {
  if (ops.length === 0) return ops;

  const tables = [...new Set(ops.map((op) => op.table))];

  // Kahn's algorithm on the dependency graph (restricted to tables in ops)
  const inDegree = new Map<string, number>(tables.map((t) => [t, 0]));
  const edges = new Map<string, string[]>(); // dep → tables that depend on it

  for (const table of tables) {
    const deps = (fkGraph.get(table) ?? []).filter((d) => inDegree.has(d));
    for (const dep of deps) {
      if (!edges.has(dep)) edges.set(dep, []);
      edges.get(dep)!.push(table);
      inDegree.set(table, (inDegree.get(table) ?? 0) + 1);
    }
  }

  const queue = tables.filter((t) => (inDegree.get(t) ?? 0) === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const t = queue.shift()!;
    sorted.push(t);
    for (const dependent of edges.get(t) ?? []) {
      const deg = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, deg);
      if (deg === 0) queue.push(dependent);
    }
  }

  // If cycle detected fall back to original order
  const order = sorted.length === tables.length ? sorted : tables;
  const orderIndex = new Map(order.map((t, i) => [t, i]));

  const inserts = ops.filter((op) => op.kind === 'insert' || op.kind === 'update');
  const deletes = ops.filter((op) => op.kind === 'delete');

  inserts.sort((a, b) => (orderIndex.get(a.table) ?? 0) - (orderIndex.get(b.table) ?? 0));
  // Deletes go in reverse dependency order (dependents first)
  deletes.sort((a, b) => (orderIndex.get(b.table) ?? 0) - (orderIndex.get(a.table) ?? 0));

  return [...inserts, ...deletes];
}
