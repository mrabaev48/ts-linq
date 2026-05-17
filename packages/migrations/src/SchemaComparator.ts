import type { SchemaSnapshot, SchemaDiff, TableDiff, TableSnapshot } from './DiffTypes';
import { diffColumns } from './comparators/ColumnComparator';
import { diffIndexes } from './comparators/IndexComparator';

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

  const expectedByName = new Map(expected.tables.map((t) => [t.name, t] as const));
  for (const actualTable of actual.tables) {
    if (!expectedByName.has(actualTable.name)) diffs.push({ table: actualTable.name, drop: true });
  }
  return { tables: diffs };
}
