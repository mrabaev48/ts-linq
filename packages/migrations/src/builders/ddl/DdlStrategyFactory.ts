import { MssqlDdlStrategy, MssqlTypeMapper } from '@ts-linq/dialect-mssql';
import { MySqlDdlStrategy, MySqlTypeMapper } from '@ts-linq/dialect-mysql';
import { PostgresDdlStrategy, PostgresTypeMapper } from '@ts-linq/dialect-postgres';
import type { DdlStrategy } from '@ts-linq/types';

import type { Dialect } from '../../Dialect';
import { SnapshotTypeMapper } from './SnapshotTypeMapper';

/**
 * Composition root for the migration DDL generator (Factory).
 *
 * The migration builders depend on the `DdlStrategy` **contract** from `@ts-linq/types` and never on
 * a concrete dialect; this one module resolves the dialect name a migration carries into the
 * matching strategy. Doing so removed the parallel `mapType`/column/PK/UNIQUE emitters migrations
 * used to own (dialect-postgres/task-10) — the logical type mapping and the identifier quoting on
 * those paths now come from the same source as the dialect packages' own DDL.
 *
 * No logger is passed: the strategies' `warn` hooks (unsupported computed storage, invalid index
 * spec) are advisory, and migrations has always generated this SQL silently. With the logger fixed
 * the strategies hold no per-migration state, so one instance per dialect is memoized — mirroring
 * the sibling `QuoterFactory`, and keeping every entry point on the same instance instead of
 * allocating a strategy (plus index builder and two mappers) per emitted statement.
 */
const INSTANCES: Partial<Record<Dialect, DdlStrategy>> = {};

export function createDdlStrategy(dialect: Dialect): DdlStrategy {
  return (INSTANCES[dialect] ??= buildDdlStrategy(dialect));
}

function buildDdlStrategy(dialect: Dialect): DdlStrategy {
  switch (dialect) {
    case 'postgresql':
      return new PostgresDdlStrategy(undefined, new SnapshotTypeMapper(new PostgresTypeMapper()));
    case 'mysql':
      return new MySqlDdlStrategy(undefined, new SnapshotTypeMapper(new MySqlTypeMapper()));
    case 'mssql':
      return new MssqlDdlStrategy(undefined, new SnapshotTypeMapper(new MssqlTypeMapper()));
    default: {
      const exhaustive: never = dialect;
      return exhaustive;
    }
  }
}
