import type { TableDiff } from '../../DiffTypes';
import type { Dialect } from '../../Dialect';
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
