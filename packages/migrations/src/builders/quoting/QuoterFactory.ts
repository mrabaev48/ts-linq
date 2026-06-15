import type { Dialect } from '../../Dialect';
import { MssqlQuoter } from './MssqlQuoter';
import { MySqlQuoter } from './MySqlQuoter';
import { PostgresQuoter } from './PostgresQuoter';
import type { SqlQuoter } from './SqlQuoter';

/**
 * Single selection point for the per-dialect {@link SqlQuoter} (Factory).
 *
 * Quoters are stateless, so one cached instance per dialect is shared. This mirrors the
 * {@link Dialect} union; adding a dialect adds a case here and a quoter class — not edits
 * scattered across every builder.
 */
export class QuoterFactory {
  private static readonly instances: Record<Dialect, SqlQuoter> = {
    postgresql: new PostgresQuoter(),
    mysql: new MySqlQuoter(),
    mssql: new MssqlQuoter()
  };

  /** Returns the audited quoter for `dialect`. */
  public static for(dialect: Dialect): SqlQuoter {
    return this.instances[dialect];
  }
}
