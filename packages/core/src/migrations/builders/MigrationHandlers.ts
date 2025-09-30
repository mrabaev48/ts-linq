import type { TableDiff, ColumnDef } from '../DiffTypes';
import type { Dialect } from '../Dialect';
import { q, mapType, formatValue, norm } from './SqlUtils';

export function handleTableRename(td: TableDiff, dialect: Dialect, up: string[]): void {
  if ((td as unknown as { renameTo?: string }).renameTo) {
    const to = (td as unknown as { renameTo?: string }).renameTo as string;
    switch (dialect) {
      case 'postgresql':
        up.push(`ALTER TABLE ${q(dialect, td.table)} RENAME TO ${q(dialect, to)}`);
        break;
      case 'mysql':
        up.push(`RENAME TABLE ${q(dialect, td.table)} TO ${q(dialect, to)}`);
        break;
      case 'mssql':
        up.push(`EXEC sp_rename '${td.table}', '${to}'`);
        break;
      default:
        up.push(`ALTER TABLE ${q(dialect, td.table)} RENAME TO ${q(dialect, to)}`);
    }
  }
}

export function handleCreateTable(
  td: TableDiff,
  dialect: Dialect,
  up: string[],
  down: string[]
): boolean {
  if (!td.create) return false;
  up.push(buildCreateTableSql(td, dialect));
  if (td.create.indexes && td.create.indexes.length > 0) {
    for (const idx of td.create.indexes) {
      const uniq = idx.unique ? 'UNIQUE ' : '';
      const cols = idx.columns.map((column) => q(dialect, column)).join(', ');
      const name = q(dialect, idx.name);
      const where = idx.where && dialect !== 'mysql' ? ` WHERE ${idx.where}` : '';
      up.push(`CREATE ${uniq}INDEX ${name} ON ${q(dialect, td.create.name)} (${cols})${where}`);
    }
  }
  down.push(`DROP TABLE ${q(dialect, td.create.name)}`);
  return true;
}

export function handleDropTable(td: TableDiff, dialect: Dialect, up: string[]): boolean {
  if (!td.drop) return false;
  up.push(`DROP TABLE ${q(dialect, td.table)}`);
  return true;
}

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

export function handleIndexDrops(td: TableDiff, dialect: Dialect, up: string[]): void {
  const id = (td as unknown as { indexDrops?: string[] }).indexDrops;
  if (!id || id.length === 0) return;
  for (const nameRaw of id) {
    switch (dialect) {
      case 'postgresql':
        up.push(`DROP INDEX IF EXISTS ${q(dialect, nameRaw)}`);
        break;
      case 'mysql':
        up.push(`ALTER TABLE ${q(dialect, td.table)} DROP INDEX ${q(dialect, nameRaw)}`);
        break;
      case 'mssql':
        up.push(`DROP INDEX ${q(dialect, nameRaw)} ON ${q(dialect, td.table)}`);
        break;
      default:
        up.push(`DROP INDEX IF EXISTS ${q(dialect, nameRaw)}`);
    }
  }
}

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

export function handleFkDrops(td: TableDiff, dialect: Dialect, up: string[]): void {
  const fkd = (td as unknown as { fkDrops?: string[] }).fkDrops;
  if (!fkd || fkd.length === 0) return;
  for (const nameRaw of fkd) up.push(buildDropFkSql(dialect, td.table, nameRaw));
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

export function handleColumnRenames(td: TableDiff, dialect: Dialect, up: string[]): void {
  const rns = (td as unknown as { columnRenames?: Array<{ from: string; to: string }> })
    .columnRenames;
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
      default:
        up.push(`-- SQLite column rename requires pragma or rebuild: ${rn.from} -> ${rn.to}`);
    }
  }
}

export function buildCreateTableSql(td: TableDiff, dialect: Dialect): string {
  const create = td.create!;
  const cols = create.columns.map((c) => renderColumn(dialect, c));
  if (create.primaryKeys && create.primaryKeys.length > 0)
    cols.push(`PRIMARY KEY (${create.primaryKeys.map((pk) => q(dialect, pk)).join(', ')})`);
  if (create.foreignKeys && create.foreignKeys.length > 0) {
    for (const fk of create.foreignKeys) cols.push(buildInlineFkSql(dialect, fk));
  }
  return `CREATE TABLE IF NOT EXISTS ${q(dialect, create.name)} (${cols.join(', ')})`;
}

export function buildInlineFkSql(
  dialect: Dialect,
  fk: {
    name?: string;
    columns: string[];
    refTable: string;
    refColumns: string[];
    onDelete?: string;
    onUpdate?: string;
  }
): string {
  const name = fk.name ? `CONSTRAINT ${q(dialect, fk.name)} ` : '';
  const colsList = fk.columns.map((c) => q(dialect, c)).join(', ');
  const refCols = fk.refColumns.map((c) => q(dialect, c)).join(', ');
  const onDel = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
  const onUpd = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
  return `${name}FOREIGN KEY (${colsList}) REFERENCES ${q(dialect, fk.refTable)} (${refCols})${onDel}${onUpd}`;
}

export function buildAddFkSql(
  dialect: Dialect,
  table: string,
  fk: {
    name?: string;
    columns: string[];
    refTable: string;
    refColumns: string[];
    onDelete?: string;
    onUpdate?: string;
  }
): string {
  switch (dialect) {
    case 'postgresql':
    case 'mysql':
    case 'mssql': {
      const inline = buildInlineFkSql(dialect, fk);
      return `ALTER TABLE ${q(dialect, table)} ADD ${inline}`;
    }
    default: {
      const name = fk.name ? `CONSTRAINT ${q(dialect, fk.name)} ` : '';
      const cols = fk.columns.join(', ');
      const refCols = fk.refColumns.join(', ');
      return `-- SQLite requires table rebuild to add FK: ${name}(${cols}) -> ${fk.refTable}(${refCols})`;
    }
  }
}

export function buildDropFkSql(dialect: Dialect, table: string, nameRaw: string): string {
  switch (dialect) {
    case 'postgresql':
      return `ALTER TABLE ${q(dialect, table)} DROP CONSTRAINT ${q(dialect, nameRaw)}`;
    case 'mysql':
      return `ALTER TABLE ${q(dialect, table)} DROP FOREIGN KEY ${q(dialect, nameRaw)}`;
    case 'mssql':
      return `ALTER TABLE ${q(dialect, table)} DROP CONSTRAINT ${q(dialect, nameRaw)}`;
    default:
      return `-- SQLite requires table rebuild to drop FK: ${nameRaw}`;
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
        const persisted = c.computedStorage === 'PERSISTED' ? ' PERSISTED' : '';
        return `${q(dialect, c.name)} AS (${c.computedExpression})${persisted}`;
      }
      default: {
        const kind = c.computedStorage === 'STORED' ? 'STORED' : 'VIRTUAL';
        return `${q(dialect, c.name)} GENERATED ALWAYS AS (${c.computedExpression}) ${kind}`;
      }
    }
  }
  const dialectMap =
    (c as { defaultExpressionDialect?: Record<string, string> }).defaultExpressionDialect || {};
  const defExpr = dialectMap[dialect] || (c as { defaultExpression?: string }).defaultExpression;
  const defSql = defExpr
    ? ` DEFAULT ${defExpr}`
    : c.defaultValue !== undefined
      ? ' DEFAULT ' + formatValue(dialect, c.defaultValue)
      : '';
  return `${q(dialect, c.name)} ${mapType(dialect, c.type)}${c.nullable ? '' : ' NOT NULL'}${defSql}`;
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
  if (dialect === 'sqlite') return `-- DROP COLUMN ${name} is not supported directly in SQLite`;
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
    default:
      return `-- ALTER TYPE not supported for sqlite; requires rebuild`;
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
    default:
      return `-- SQLite nullability alter requires rebuild`;
  }
}
