export { BaseEmitter } from './BaseEmitter';
export { PostgresEmitter } from './PostgresEmitter';
export { MysqlEmitter } from './MysqlEmitter';
export { MssqlEmitter } from './MssqlEmitter';
export { SqliteEmitter } from './SqliteEmitter';
export type { DialectSqlEmitter, Dialect } from './types';

import { PostgresEmitter as PG } from './PostgresEmitter';
import { MysqlEmitter as MY } from './MysqlEmitter';
import { MssqlEmitter as MS } from './MssqlEmitter';
import { SqliteEmitter as SQ } from './SqliteEmitter';

export function createEmitter(dialect: import('./types').Dialect) {
  switch (dialect) {
    case 'postgresql':
      return new PG();
    case 'mysql':
      return new MY();
    case 'mssql':
      return new MS();
    default:
      return new SQ();
  }
}
