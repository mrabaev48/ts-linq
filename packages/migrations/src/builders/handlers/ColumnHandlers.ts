import type { Dialect } from '../../Dialect';
import type { ColumnChange, ColumnDef, TableDiff } from '../../DiffTypes';
import { formatValue, mapType, norm, q } from '../SqlUtils';

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

export function renderColumn(dialect: Dialect, c: ColumnDef): string {
  if (c.isComputed && c.computedExpression) {
    switch (dialect) {
      case 'postgresql':
        return `${q(dialect, c.name)} ${mapType(dialect, c.type)} GENERATED ALWAYS AS (${c.computedExpression}) STORED`;
      case 'mysql': {
        const kind = c.computedStorage === 'STORED' ? 'STORED' : 'VIRTUAL';
        return `${q(dialect, c.name)} ${mapType(dialect, c.type)} GENERATED ALWAYS AS (${c.computedExpression}) ${kind}`;
      }
      case 'mssql': {
        const persisted =
          c.computedStorage === 'PERSISTED' || c.computedStorage === 'STORED' ? ' PERSISTED' : '';
        return `${q(dialect, c.name)} AS (${c.computedExpression})${persisted}`;
      }
      default: {
        const _exhaustive: never = dialect;
        return _exhaustive;
      }
    }
  }
  const dialectMap =
    (c as { defaultExpressionDialect?: Record<string, string> }).defaultExpressionDialect || {};
  const defExpr = dialectMap[dialect] || c.defaultExpression;
  const defSql = defExpr
    ? ` DEFAULT ${defExpr}`
    : c.defaultValue !== undefined
      ? ' DEFAULT ' + formatValue(dialect, c.defaultValue)
      : '';
  const commentSql =
    dialect === 'mysql' && c.comment ? ` COMMENT '${c.comment.replace(/'/g, "''")}'` : '';
  return `${q(dialect, c.name)} ${mapType(dialect, c.type)}${c.nullable ? '' : ' NOT NULL'}${defSql}${commentSql}`;
}

export function buildAddColumnSql(
  dialect: Dialect,
  td: TableDiff,
  name: string,
  type: string,
  nullable: boolean,
  def?: unknown
): string {
  const table = q(dialect, td.table);
  const col = q(dialect, name);
  const typeSql = mapType(dialect, type);
  const nn = nullable ? '' : ' NOT NULL';
  const d = def !== undefined ? ` DEFAULT ${formatValue(dialect, def)}` : '';
  const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
  return `ALTER TABLE ${table} ${kw} ${col} ${typeSql}${nn}${d}`;
}

export function buildDropColumnSql(dialect: Dialect, table: string, name: string): string {
  return `ALTER TABLE ${q(dialect, table)} DROP COLUMN ${q(dialect, name)}`;
}

export function buildAlterTypeSql(
  dialect: Dialect,
  table: string,
  name: string,
  newType: string
): string {
  const tableName = q(dialect, table);
  const columnName = q(dialect, name);
  const mappedType = mapType(dialect, newType);
  switch (dialect) {
    case 'postgresql':
      return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE ${mappedType}`;
    case 'mysql':
      return `ALTER TABLE ${tableName} MODIFY COLUMN ${columnName} ${mappedType}`;
    case 'mssql':
      return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${mappedType}`;
    default: {
      const _exhaustive: never = dialect;
      return _exhaustive;
    }
  }
}

export function renderCheckConstraint(dialect: Dialect, c: { name: string; sql: string }): string {
  return `CONSTRAINT ${q(dialect, c.name)} CHECK (${c.sql})`;
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
  td: TableDiff,
  dialect: Dialect,
  up: string[],
  down: string[]
): void {
  if (!td.columnChanges || td.columnChanges.length === 0) return;
  for (const ch of td.columnChanges) {
    if (ch.kind === 'add') {
      handleAddColumnChange(dialect, td, ch, up, down);
      continue;
    }
    if (ch.kind === 'alter') {
      handleAlterColumnChange(dialect, td, ch, up);
      continue;
    }
    if (ch.kind === 'drop') {
      handleDropColumnChange(dialect, td, ch, up);
    }
  }
}

export function handleAddColumnChange(
  dialect: Dialect,
  td: TableDiff,
  ch: ColumnChange,
  up: string[],
  down: string[]
): void {
  if (isComputedColumn(ch.column) || hasDefaultExpression(ch.column)) {
    const colSql = renderColumn(dialect, ch.column);
    const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
    up.push(`ALTER TABLE ${q(dialect, td.table)} ${kw} ${colSql}`);
  } else {
    up.push(
      buildAddColumnSql(
        dialect,
        td,
        ch.column.name,
        ch.column.type,
        ch.column.nullable,
        ch.column.defaultValue
      )
    );
  }
  down.push(buildDropColumnSql(dialect, td.table, ch.column.name));
}

export function handleAlterColumnChange(
  dialect: Dialect,
  td: TableDiff,
  ch: ColumnChange,
  up: string[]
): void {
  if (isComputedChanged(ch.prev, ch.column)) {
    up.push(buildDropColumnSql(dialect, td.table, ch.column.name));
    const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
    up.push(`ALTER TABLE ${q(dialect, td.table)} ${kw} ${renderColumn(dialect, ch.column)}`);
    return;
  }
  if (hasTypeChanged(ch.prev, ch.column)) {
    up.push(buildAlterTypeSql(dialect, td.table, ch.column.name, ch.column.type));
  }
  const prevNullable = ch.prev?.nullable;
  if (typeof prevNullable === 'boolean' && prevNullable !== ch.column.nullable) {
    up.push(buildAlterNullSql(dialect, td.table, ch.column.name, ch.column.nullable));
  }
}

export function handleDropColumnChange(
  dialect: Dialect,
  td: TableDiff,
  ch: ColumnChange,
  up: string[]
): void {
  up.push(buildDropColumnSql(dialect, td.table, ch.column.name));
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
