import type { Dialect } from '../Dialect';
import type { TableDiff, UniqueConstraintDef } from '../DiffTypes';
import { q } from './SqlUtils';

/**
 * Emits `ADD CONSTRAINT … UNIQUE` (or the MySQL `ADD UNIQUE KEY` equivalent) for a named
 * unique constraint. All identifiers are routed through the audited quoter ({@link q}).
 */
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
      return `ALTER TABLE ${q(dialect, tableName)} ADD UNIQUE KEY ${q(dialect, uc.name)} (${cols})`;
    case 'mssql':
      return `ALTER TABLE ${q(dialect, tableName)} ADD CONSTRAINT ${q(dialect, uc.name)} UNIQUE (${cols})`;
    default:
      return `ALTER TABLE ${q(dialect, tableName)} ADD CONSTRAINT ${q(dialect, uc.name)} UNIQUE (${cols})`;
  }
}

/**
 * Emits the `DROP CONSTRAINT` (or MySQL `DROP INDEX`) statement for a named unique
 * constraint. The constraint name is routed through the audited quoter ({@link q}).
 */
export function buildDropUniqueConstraintSql(
  dialect: Dialect,
  tableName: string,
  name: string
): string {
  switch (dialect) {
    case 'postgresql':
      return `ALTER TABLE ${q(dialect, tableName)} DROP CONSTRAINT IF EXISTS ${q(dialect, name)}`;
    case 'mysql':
      return `ALTER TABLE ${q(dialect, tableName)} DROP INDEX ${q(dialect, name)}`;
    case 'mssql':
      return `ALTER TABLE ${q(dialect, tableName)} DROP CONSTRAINT ${q(dialect, name)}`;
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

export class UniqueConstraintsSqlBuilder {
  constructor(private readonly dialect: Dialect) {}

  create(td: TableDiff, up: string[]): void {
    handleUniqueConstraintCreates(td, this.dialect, up);
  }

  drop(td: TableDiff, up: string[]): void {
    handleUniqueConstraintDrops(td, this.dialect, up);
  }
}
