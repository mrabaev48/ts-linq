export function normalizeType(typeName) {
  return String(typeName || '')
    .trim()
    .toUpperCase();
}
export function isColumnAltered(expectedColumn, actualColumn) {
  const typeChanged = normalizeType(expectedColumn.type) !== normalizeType(actualColumn.type || '');
  const nullableChanged =
    typeof actualColumn.nullable === 'boolean'
      ? expectedColumn.nullable !== actualColumn.nullable
      : false;
  const expectedIsComputed = !!expectedColumn.isComputed;
  const actualIsComputed = !!actualColumn.isComputed;
  const expectedExpr = expectedColumn.computedExpression;
  const actualExpr = actualColumn.computedExpression;
  const expectedStorage = expectedColumn.computedStorage;
  const actualStorage = actualColumn.computedStorage;
  const computedChanged =
    expectedIsComputed !== actualIsComputed ||
    (expectedExpr || '') !== (actualExpr || '') ||
    (expectedStorage || '') !== (actualStorage || '');
  const defaultExprChanged =
    (expectedColumn.defaultExpression || '') !== (actualColumn.defaultExpression || '');
  return typeChanged || nullableChanged || computedChanged || defaultExprChanged;
}
export function diffColumns(expectedTable, actualTable) {
  const changes = [];
  const actualColsByName = new Map(actualTable.columns.map((c) => [c.name, c]));
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
  const expectedColsByName = new Map(expectedTable.columns.map((c) => [c.name, c]));
  for (const actualColumn of actualTable.columns) {
    if (!expectedColsByName.has(actualColumn.name))
      changes.push({ kind: 'drop', column: actualColumn });
  }
  return changes;
}
//# sourceMappingURL=ColumnComparator.js.map
