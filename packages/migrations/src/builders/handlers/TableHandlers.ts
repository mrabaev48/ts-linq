import type { Dialect } from '../../Dialect';
import type { TableDiff } from '../../DiffTypes';
import { q } from '../SqlUtils';
import { renderColumn } from './ColumnHandlers';
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
  td: TableDiff,
  dialect: Dialect,
  up: string[],
  down: string[]
): boolean {
  if (!td.create) return false;
  up.push(buildCreateTableSql(td, dialect));
  if (td.create.uniqueConstraints && td.create.uniqueConstraints.length > 0) {
    for (const uc of td.create.uniqueConstraints) {
      const cols = uc.columns.map((c) => q(dialect, c)).join(', ');
      if (dialect === 'mysql') {
        up.push(`ALTER TABLE \`${td.create.name}\` ADD UNIQUE KEY \`${uc.name}\` (${cols})`);
      } else if (dialect === 'mssql') {
        up.push(`ALTER TABLE [${td.create.name}] ADD CONSTRAINT [${uc.name}] UNIQUE (${cols})`);
      } else {
        up.push(
          `ALTER TABLE ${q(dialect, td.create.name)} ADD CONSTRAINT ${q(dialect, uc.name)} UNIQUE (${cols})`
        );
      }
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

export function buildCreateTableSql(td: TableDiff, dialect: Dialect): string {
  const create = td.create!;
  const cols = create.columns.map((c) => renderColumn(dialect, c));
  if (create.primaryKeys && create.primaryKeys.length > 0)
    cols.push(`PRIMARY KEY (${create.primaryKeys.map((pk) => q(dialect, pk)).join(', ')})`);
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
