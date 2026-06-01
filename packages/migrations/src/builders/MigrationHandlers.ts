// Re-export legacy API from split handlers for backwards compatibility
import type { Dialect } from '../Dialect';
import type { ColumnDef, TableDiff, UniqueConstraintDef } from '../DiffTypes';
import {
  buildAddColumnSql,
  buildAlterNullSql,
  buildAlterTypeSql,
  buildDropColumnSql,
  renderColumn
} from './handlers/ColumnHandlers';
import { buildAddFkSql } from './handlers/ForeignKeyHandlers';
import { norm, q } from './SqlUtils';
export {
  buildAddColumnSql,
  buildAlterNullSql,
  buildAlterTypeSql,
  buildDropColumnSql,
  renderColumn
} from './handlers/ColumnHandlers';
export {
  buildAddFkSql,
  buildDropFkSql,
  buildInlineFkSql,
  deleteBehaviorToSql
} from './handlers/ForeignKeyHandlers';
export {
  buildCreateTableSql,
  handleCreateTable,
  handleDropTable,
  handleTableRename
} from './handlers/TableHandlers';

export function handleIndexCreates(td: TableDiff, dialect: Dialect, up: string[]): void {
  const ic = td.indexCreates;
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
      ? dialect === 'postgresql'
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
  const fkc = td.fkCreates;
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
      handleAddColumnChange(
        dialect,
        td,
        ch as { kind: 'add'; column: ColumnDef; prev?: ColumnDef },
        up,
        down
      );
      continue;
    }
    if (ch.kind === 'alter') {
      handleAlterColumnChange(
        dialect,
        td,
        ch as { kind: 'alter'; column: ColumnDef; prev?: ColumnDef },
        up
      );
      continue;
    }
    if (ch.kind === 'drop') {
      handleDropColumnChange(
        dialect,
        td,
        ch as { kind: 'drop'; column: ColumnDef; prev?: ColumnDef },
        up
      );
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
  const pgInclude =
    dialect === 'postgresql' && idx.include && idx.include.length > 0
      ? ` INCLUDE (${idx.include.map((c) => q(dialect, c)).join(', ')})`
      : '';
  switch (dialect) {
    case 'postgresql':
      return `CREATE ${uniq}INDEX${concurrently} ${name} ON ${q(dialect, table)}${using} (${cols})${pgInclude}${withSql}${where}`;
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

export function buildAddUniqueConstraintSql(
  dialect: Dialect,
  tableName: string,
  uc: UniqueConstraintDef
): string {
  const cols = uc.columns.map((c) => q(dialect, c)).join(', ');
  switch (dialect) {
    case 'postgresql':
      return `ALTER TABLE ${q(dialect, tableName)} ADD CONSTRAINT ${q(dialect, uc.name)} UNIQUE (${cols})`;
    case 'mysql':
      return `ALTER TABLE \`${tableName}\` ADD UNIQUE KEY \`${uc.name}\` (${cols})`;
    case 'mssql':
      return `ALTER TABLE [${tableName}] ADD CONSTRAINT [${uc.name}] UNIQUE (${cols})`;
    default:
      return `ALTER TABLE ${q(dialect, tableName)} ADD CONSTRAINT ${q(dialect, uc.name)} UNIQUE (${cols})`;
  }
}

export function buildDropUniqueConstraintSql(
  dialect: Dialect,
  tableName: string,
  name: string
): string {
  switch (dialect) {
    case 'postgresql':
      return `ALTER TABLE ${q(dialect, tableName)} DROP CONSTRAINT IF EXISTS ${q(dialect, name)}`;
    case 'mysql':
      return `ALTER TABLE \`${tableName}\` DROP INDEX \`${name}\``;
    case 'mssql':
      return `ALTER TABLE [${tableName}] DROP CONSTRAINT [${name}]`;
    default:
      return `ALTER TABLE ${q(dialect, tableName)} DROP CONSTRAINT ${q(dialect, name)}`;
  }
}

export function handleUniqueConstraintCreates(td: TableDiff, dialect: Dialect, up: string[]): void {
  if (!td.uniqueConstraintCreates || td.uniqueConstraintCreates.length === 0) return;
  for (const uc of td.uniqueConstraintCreates) {
    up.push(buildAddUniqueConstraintSql(dialect, td.table, uc));
  }
}

export function handleUniqueConstraintDrops(td: TableDiff, dialect: Dialect, up: string[]): void {
  if (!td.uniqueConstraintDrops || td.uniqueConstraintDrops.length === 0) return;
  for (const name of td.uniqueConstraintDrops) {
    up.push(buildDropUniqueConstraintSql(dialect, td.table, name));
  }
}
