export function compareSchemas(expected, actual) {
  const diffs = [];
  const actualByName = new Map(actual.tables.map((t) => [t.name, t]));
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
  const expectedByName = new Map(expected.tables.map((t) => [t.name, t]));
  for (const actualTable of actual.tables) {
    if (!expectedByName.has(actualTable.name)) diffs.push({ table: actualTable.name, drop: true });
  }
  return { tables: diffs };
}
function diffExistingTable(expectedTable, actualTable) {
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
//# sourceMappingURL=DiffTypes.js.map
