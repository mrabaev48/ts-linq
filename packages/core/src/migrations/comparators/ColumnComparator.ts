import type { ColumnDef, ColumnChange, TableSnapshot } from '../DiffTypes';

export function normalizeType(typeName: string): string {
  return String(typeName || '')
    .trim()
    .toUpperCase();
}

export function isColumnAltered(expectedColumn: ColumnDef, actualColumn: ColumnDef): boolean {
  const typeChanged = normalizeType(expectedColumn.type) !== normalizeType(actualColumn.type || '');
  const nullableChanged =
    typeof (actualColumn as { nullable?: boolean }).nullable === 'boolean'
      ? expectedColumn.nullable !== (actualColumn as { nullable?: boolean }).nullable!
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

export function diffColumns(
  expectedTable: TableSnapshot,
  actualTable: TableSnapshot
): ColumnChange[] {
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
