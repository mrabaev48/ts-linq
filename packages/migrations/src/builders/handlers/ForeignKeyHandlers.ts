import type { TableDiff } from '../../DiffTypes';
import type { Dialect } from '../../Dialect';
import { q } from '../SqlUtils';

export function handleFkDrops(td: TableDiff, dialect: Dialect, up: string[]): void {
  const fkd = td.fkDrops;
  if (!fkd || fkd.length === 0) return;
  for (const nameRaw of fkd) up.push(buildDropFkSql(dialect, td.table, nameRaw));
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
      const _exhaustive: never = dialect;
      return _exhaustive;
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
    default: {
      const _exhaustive: never = dialect;
      return _exhaustive;
    }
  }
}
