import type { Dialect } from '../../Dialect';
import type { TableDiff } from '../../DiffTypes';
import { q } from '../SqlUtils';

export function handleIndexDrops(td: TableDiff, dialect: Dialect, up: string[]): void {
  const id = td.indexDrops;
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
