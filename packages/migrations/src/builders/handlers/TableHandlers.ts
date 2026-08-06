import type { DdlStrategy } from '@ts-linq/types';

import type { Dialect } from '../../Dialect';
import type { TableDiff } from '../../DiffTypes';
import { toColumnMetadata, toEntityMetadata } from '../ddl/ColumnAdapter';
import { createDdlStrategy } from '../ddl/DdlStrategyFactory';
import { q } from '../SqlUtils';
import { buildInlineFkSql } from './ForeignKeyHandlers';

export function handleTableRename(td: TableDiff, dialect: Dialect, up: string[]): void {
  if (td.renameTo) {
    const to = td.renameTo;
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
  ddl: DdlStrategy,
  td: TableDiff,
  dialect: Dialect,
  up: string[],
  down: string[]
): boolean {
  if (!td.create) return false;
  up.push(buildCreateTableSql(td, dialect, ddl));
  if (td.create.uniqueConstraints && td.create.uniqueConstraints.length > 0) {
    for (const uc of td.create.uniqueConstraints) {
      up.push(ddl.generateAddUniqueConstraintSql(td.create.name, uc.name, uc.columns));
    }
  }
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

/**
 * CREATE TABLE for a snapshot table. Column definitions and the `PRIMARY KEY (…)` clause come from
 * the shared {@link DdlStrategy}; the statement wrapper and inline foreign keys stay here because
 * the migrations wrapper (MSSQL `IF OBJECT_ID(…)`) and composite inline FKs have no counterpart in
 * the `DdlStrategy` contract yet.
 *
 * `ddl` defaults to the dialect's strategy so the published signature stays source-compatible for
 * external callers; the migration pipeline passes its own instance.
 */
export function buildCreateTableSql(
  td: TableDiff,
  dialect: Dialect,
  ddl: DdlStrategy = createDdlStrategy(dialect)
): string {
  const create = td.create!;
  const columns = create.columns.map((c) => toColumnMetadata(dialect, c));
  const cols = columns.map((column) => ddl.generateColumnDefinition(column));
  const primaryKey = ddl.generatePrimaryKeyClause(toEntityMetadata(create, columns));
  if (primaryKey) cols.push(primaryKey);
  if (create.foreignKeys && create.foreignKeys.length > 0) {
    for (const fk of create.foreignKeys) cols.push(buildInlineFkSql(dialect, fk));
  }
  const body = `(${cols.join(', ')})`;
  if (dialect === 'mssql') {
    const tbl = q(dialect, create.name);
    return `IF OBJECT_ID(N'${create.name}', N'U') IS NULL BEGIN CREATE TABLE ${tbl} ${body} END`;
  }
  return `CREATE TABLE IF NOT EXISTS ${q(dialect, create.name)} ${body}`;
}
