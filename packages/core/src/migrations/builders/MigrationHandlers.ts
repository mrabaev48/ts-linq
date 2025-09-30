// Re-export legacy API from split handlers for backwards compatibility
import type { TableDiff, ColumnDef } from '../DiffTypes';
import type { Dialect } from '../Dialect';
import { q, norm } from './SqlUtils';
import {
  renderColumn,
  buildAddColumnSql,
  buildDropColumnSql,
  buildAlterTypeSql,
  buildAlterNullSql
} from './handlers/ColumnHandlers';
import { buildAddFkSql } from './handlers/ForeignKeyHandlers';
export {
  renderColumn,
  buildAddColumnSql,
  buildDropColumnSql,
  buildAlterTypeSql,
  buildAlterNullSql
} from './handlers/ColumnHandlers';
export { buildInlineFkSql, buildAddFkSql, buildDropFkSql } from './handlers/ForeignKeyHandlers';
export {
  handleTableRename,
  handleCreateTable,
  handleDropTable,
  buildCreateTableSql
} from './handlers/TableHandlers';

export function handleIndexCreates(td: TableDiff, dialect: Dialect, up: string[]): void {
  const ic = (
    td as unknown as {
      indexCreates?: Array<{
        name: string;
        columns: string[];
        unique?: boolean;
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
      }>;
    }
  ).indexCreates;
  if (!ic || ic.length === 0) return;
  for (const idx of ic) {
    const hasCols = Array.isArray(idx.columns) && idx.columns.length > 0;
    const hasExpr = Array.isArray(idx.expressions) && idx.expressions.length > 0;
    if (!hasCols && !hasExpr) continue;
    up.push(buildCreateIndexSql(dialect, td.table, idx));
  }
}

export function buildIndexColumnsList(
  dialect: Dialect,
  columns: string[],
  orders?: { [column: string]: 'ASC' | 'DESC' },
  collations?: { [column: string]: string },
  nulls?: { [column: string]: 'FIRST' | 'LAST' },
  expressions?: string[]
): string {
  const parts: string[] = [];
  for (const c of columns) {
    const ord = orders?.[c] ? ` ${orders[c]}` : '';
    const collation = collations?.[c]
      ? dialect === 'postgresql' || dialect === 'sqlite'
        ? ` COLLATE ${collations[c]}`
        : ''
      : '';
    const nullsSql = dialect === 'postgresql' && nulls?.[c] ? ` NULLS ${nulls[c]}` : '';
    parts.push(`${q(dialect, c)}${ord}${collation}${nullsSql}`);
  }
  for (const e of expressions || []) parts.push(`(${e})`);
  return parts.join(', ');
}

export { handleIndexDrops } from './handlers/IndexHandlers';

export function handleFkCreates(td: TableDiff, dialect: Dialect, up: string[]): void {
  const fkc = (
    td as unknown as {
      fkCreates?: Array<{
        name?: string;
        columns: string[];
        refTable: string;
        refColumns: string[];
        onDelete?: string;
        onUpdate?: string;
      }>;
    }
  ).fkCreates;
  if (!fkc || fkc.length === 0) return;
  for (const fk of fkc) {
    const okCols = Array.isArray(fk.columns) && fk.columns.length > 0;
    const okRef = Array.isArray(fk.refColumns) && fk.refColumns.length > 0;
    if (!okCols || !okRef) continue;
    up.push(buildAddFkSql(dialect, td.table, fk));
  }
}

export { handleFkDrops } from './handlers/ForeignKeyHandlers';

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

export function buildCreateIndexSql(
  dialect: Dialect,
  table: string,
  idx: {
    name: string;
    columns: string[];
    unique?: boolean;
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
): string {
  const uniq = idx.unique ? 'UNIQUE ' : '';
  const name = q(dialect, idx.name);
  const cols = buildIndexColumnsList(
    dialect,
    idx.columns,
    idx.orders,
    idx.collations,
    idx.nulls,
    idx.expressions
  );
  const where = buildIndexWhere(dialect, idx.where);
  const using = buildIndexUsing(dialect, idx.using);
  const concurrently = buildIndexConcurrently(dialect, idx.concurrently);
  const withSql = buildIndexWithParams(dialect, idx.withParams);
  const visibility = buildIndexVisibility(dialect, idx.mysqlVisibility);
  const include = buildIndexInclude(dialect, idx.include);
  switch (dialect) {
    case 'postgresql':
      return `CREATE ${uniq}INDEX${concurrently} ${name} ON ${q(dialect, table)}${using} (${cols})${withSql}${where}`;
    case 'mysql':
      return `CREATE ${uniq}INDEX ${name} ON ${q(dialect, table)} (${cols})${visibility}`;
    case 'mssql':
      return `CREATE ${uniq}INDEX ${name} ON ${q(dialect, table)} (${cols})${include}${where}`;
    default:
      return `CREATE ${uniq}INDEX ${name} ON ${q(dialect, table)} (${cols})${where}`;
  }
}

export function buildIndexWhere(dialect: Dialect, where?: string): string {
  return where && dialect !== 'mysql' ? ` WHERE ${where}` : '';
}

export function buildIndexUsing(
  dialect: Dialect,
  using?: 'btree' | 'hash' | 'gin' | 'gist'
): string {
  return dialect === 'postgresql' && using ? ` USING ${using.toUpperCase()}` : '';
}

export function buildIndexConcurrently(dialect: Dialect, concurrently?: boolean): string {
  return dialect === 'postgresql' && concurrently ? ' CONCURRENTLY' : '';
}

export function buildIndexWithParams(
  dialect: Dialect,
  withParams?: Record<string, string | number | boolean>
): string {
  if (dialect !== 'postgresql' || !withParams || Object.keys(withParams).length === 0) return '';
  const body = Object.entries(withParams)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? `'${v}'` : String(v)}`)
    .join(', ');
  return ` WITH (${body})`;
}

export function buildIndexVisibility(
  dialect: Dialect,
  visibility?: 'VISIBLE' | 'INVISIBLE'
): string {
  return dialect === 'mysql' && visibility ? ` ${visibility}` : '';
}

export function buildIndexInclude(dialect: Dialect, include?: string[]): string {
  return dialect === 'mssql' && include && include.length > 0
    ? ` INCLUDE (${include.map((c) => q(dialect, c)).join(', ')})`
    : '';
}

export function handleAddColumnChange(
  dialect: Dialect,
  td: TableDiff,
  ch: { kind: 'add'; column: ColumnDef },
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
  ch: { kind: 'alter'; column: ColumnDef; prev?: ColumnDef },
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
  const prevNullable = (ch.prev as { nullable?: boolean } | undefined)?.nullable;
  if (typeof prevNullable === 'boolean' && prevNullable !== ch.column.nullable) {
    up.push(buildAlterNullSql(dialect, td.table, ch.column.name, ch.column.nullable));
  }
}

export function handleDropColumnChange(
  dialect: Dialect,
  td: TableDiff,
  ch: { kind: 'drop'; column: ColumnDef },
  up: string[]
): void {
  up.push(buildDropColumnSql(dialect, td.table, ch.column.name));
}

export function isComputedColumn(c: ColumnDef): boolean {
  return (
    !!(c as { isComputed?: boolean }).isComputed &&
    !!(c as { computedExpression?: string }).computedExpression
  );
}

export function hasDefaultExpression(c: ColumnDef): boolean {
  return !!(c as { defaultExpression?: string }).defaultExpression;
}

export function isComputedChanged(prev: ColumnDef | undefined, curr: ColumnDef): boolean {
  const p = prev as
    | { isComputed?: boolean; computedExpression?: string; computedStorage?: string }
    | undefined;
  return (
    p?.isComputed !== (curr as { isComputed?: boolean }).isComputed ||
    p?.computedExpression !== (curr as { computedExpression?: string }).computedExpression ||
    p?.computedStorage !== (curr as { computedStorage?: string }).computedStorage
  );
}

export function hasTypeChanged(prev: ColumnDef | undefined, curr: ColumnDef): boolean {
  return !!prev && norm(prev.type) !== norm(curr.type);
}

export { handleColumnRenames } from './handlers/ColumnHandlers';

// moved to handlers/TableHandlers.ts

// moved to handlers/ForeignKeyHandlers.ts

// moved to handlers/ForeignKeyHandlers.ts

// moved to handlers/ForeignKeyHandlers.ts

// moved to handlers/ColumnHandlers.ts

// moved to handlers/ColumnHandlers.ts

// moved to handlers/ColumnHandlers.ts

// moved to handlers/ColumnHandlers.ts

// moved to handlers/ColumnHandlers.ts
