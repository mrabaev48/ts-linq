import { DeleteBehavior } from '@ts-linq/types';

import type { Dialect } from '../../Dialect';
import type { TableDiff } from '../../DiffTypes';
import { q } from '../SqlUtils';

/**
 * Maps a DeleteBehavior enum value to the SQL ON DELETE clause string.
 * Client-side-only behaviors (ClientCascade, ClientSetNull, ClientNoAction) return
 * undefined — no ON DELETE clause is emitted and the database uses its default (NO ACTION).
 */
export function deleteBehaviorToSql(behavior: DeleteBehavior): string | undefined {
  switch (behavior) {
    case DeleteBehavior.Cascade:
      return 'CASCADE';
    case DeleteBehavior.Restrict:
      return 'RESTRICT';
    case DeleteBehavior.SetNull:
      return 'SET NULL';
    case DeleteBehavior.NoAction:
      return 'NO ACTION';
    case DeleteBehavior.ClientSetNull:
    case DeleteBehavior.ClientCascade:
    case DeleteBehavior.ClientNoAction:
      return undefined;
  }
}

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
