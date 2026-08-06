import type { DdlStrategy } from '@ts-linq/types';

import type { Dialect } from '../../Dialect';
import type { ColumnChange, ColumnDef, TableDiff } from '../../DiffTypes';
import { toColumnMetadata } from '../ddl/ColumnAdapter';
import { norm, q } from '../SqlUtils';

export function handleColumnRenames(td: TableDiff, dialect: Dialect, up: string[]): void {
  const rns = td.columnRenames;
  if (!rns || rns.length === 0) return;
  for (const rn of rns) {
    if (!rn.from || !rn.to) continue;
    switch (dialect) {
      case 'postgresql':
        up.push(
          `ALTER TABLE ${q(dialect, td.table)} RENAME COLUMN ${q(dialect, rn.from)} TO ${q(dialect, rn.to)}`
        );
        break;
      case 'mysql':
        up.push(`-- MySQL requires full type for CHANGE COLUMN ${rn.from} -> ${rn.to}`);
        break;
      case 'mssql':
        up.push(`EXEC sp_rename '${td.table}.${rn.from}', '${rn.to}', 'COLUMN'`);
        break;
      default: {
        const _exhaustive: never = dialect;
        return _exhaustive;
      }
    }
  }
}

export function buildAlterNullSql(
  dialect: Dialect,
  table: string,
  name: string,
  nullable: boolean
): string {
  const tableName = q(dialect, table);
  const columnName = q(dialect, name);
  switch (dialect) {
    case 'postgresql':
      return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${nullable ? 'DROP NOT NULL' : 'SET NOT NULL'}`;
    case 'mysql':
      return `-- MySQL requires full type in MODIFY for nullability; include in type alter`;
    case 'mssql':
      return `-- MSSQL requires full type in ALTER COLUMN for nullability; include in type alter`;
    default: {
      const _exhaustive: never = dialect;
      return _exhaustive;
    }
  }
}

export function handleColumnChanges(
  ddl: DdlStrategy,
  td: TableDiff,
  dialect: Dialect,
  up: string[],
  down: string[]
): void {
  if (!td.columnChanges || td.columnChanges.length === 0) return;
  for (const ch of td.columnChanges) {
    if (ch.kind === 'add') {
      handleAddColumnChange(ddl, dialect, td, ch, up, down);
      continue;
    }
    if (ch.kind === 'alter') {
      handleAlterColumnChange(ddl, dialect, td, ch, up);
      continue;
    }
    if (ch.kind === 'drop') {
      handleDropColumnChange(ddl, td, ch, up);
    }
  }
}

export function handleAddColumnChange(
  ddl: DdlStrategy,
  dialect: Dialect,
  td: TableDiff,
  ch: ColumnChange,
  up: string[],
  down: string[]
): void {
  // Historical asymmetry, preserved byte-for-byte: only the computed / default-expression form of
  // ADD COLUMN carries the column comment — the plain form has always dropped it, while CREATE
  // TABLE emits it in both cases. Unifying this is tracked as follow-up debt, not changed silently.
  const rendersFullColumnDef = isComputedColumn(ch.column) || hasDefaultExpression(ch.column);
  const column = toColumnMetadata(dialect, ch.column);
  if (!rendersFullColumnDef) column.comment = undefined;
  up.push(ddl.generateAddColumnSql(td.table, column));
  down.push(ddl.generateDropColumnSql(td.table, ch.column.name));
}

export function handleAlterColumnChange(
  ddl: DdlStrategy,
  dialect: Dialect,
  td: TableDiff,
  ch: ColumnChange,
  up: string[]
): void {
  if (isComputedChanged(ch.prev, ch.column)) {
    up.push(ddl.generateDropColumnSql(td.table, ch.column.name));
    up.push(ddl.generateAddColumnSql(td.table, toColumnMetadata(dialect, ch.column)));
    return;
  }
  if (hasTypeChanged(ch.prev, ch.column)) {
    up.push(ddl.generateAlterColumnTypeSql(td.table, ch.column.name, ch.column.type));
  }
  const prevNullable = ch.prev?.nullable;
  if (typeof prevNullable === 'boolean' && prevNullable !== ch.column.nullable) {
    up.push(buildAlterNullSql(dialect, td.table, ch.column.name, ch.column.nullable));
  }
}

export function handleDropColumnChange(
  ddl: DdlStrategy,
  td: TableDiff,
  ch: ColumnChange,
  up: string[]
): void {
  up.push(ddl.generateDropColumnSql(td.table, ch.column.name));
}

export function isComputedColumn(c: ColumnDef): boolean {
  return !!c.isComputed && !!c.computedExpression;
}

export function hasDefaultExpression(c: ColumnDef): boolean {
  return !!c.defaultExpression;
}

export function isComputedChanged(prev: ColumnDef | undefined, curr: ColumnDef): boolean {
  return (
    prev?.isComputed !== curr.isComputed ||
    prev?.computedExpression !== curr.computedExpression ||
    prev?.computedStorage !== curr.computedStorage
  );
}

export function hasTypeChanged(prev: ColumnDef | undefined, curr: ColumnDef): boolean {
  return !!prev && norm(prev.type) !== norm(curr.type);
}
