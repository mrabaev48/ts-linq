import { q } from '../SqlUtils';
export function handleFkDrops(td, dialect, up) {
  const fkd = td.fkDrops;
  if (!fkd || fkd.length === 0) return;
  for (const nameRaw of fkd) up.push(buildDropFkSql(dialect, td.table, nameRaw));
}
export function buildInlineFkSql(dialect, fk) {
  const name = fk.name ? `CONSTRAINT ${q(dialect, fk.name)} ` : '';
  const colsList = fk.columns.map((c) => q(dialect, c)).join(', ');
  const refCols = fk.refColumns.map((c) => q(dialect, c)).join(', ');
  const onDel = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
  const onUpd = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
  return `${name}FOREIGN KEY (${colsList}) REFERENCES ${q(dialect, fk.refTable)} (${refCols})${onDel}${onUpd}`;
}
export function buildAddFkSql(dialect, table, fk) {
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
export function buildDropFkSql(dialect, table, nameRaw) {
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
//# sourceMappingURL=ForeignKeyHandlers.js.map
