import type { DatabaseProvider } from '@ts-linq/core';

import type { Dialect } from '../Dialect';
import type { MigrationHistoryStore, MigrationRecord } from './MigrationHistoryStore';
import { buildEnsureMigrationsTableSql, MIGRATIONS_TABLE } from './MigrationsTableSchema';

/** Raw row shape returned by the bookkeeping `SELECT`. */
interface MigrationRow {
  version: string;
  name: string;
  applied_at: string;
}

/**
 * Provider-backed default {@link MigrationHistoryStore}.
 *
 * All bookkeeping SQL lives here (not in the runner): the `CREATE TABLE` DDL is delegated to the
 * shared {@link buildEnsureMigrationsTableSql} — the single source of truth with the idempotent
 * emitter.
 *
 * **No interpolated user data.** The only identifier is the fixed `__migrations` constant (never
 * user-supplied, so the task-1 quoting layer is unnecessary here), and every value is bound via a
 * `?` placeholder. Every provider normalizes `?` — PostgreSQL rewrites `?` → `$n`, SQL Server
 * `?` → `@pn`, and MySQL consumes `?` natively — so the store needs no dialect-specific
 * placeholder logic.
 */
export class DefaultMigrationHistoryStore implements MigrationHistoryStore {
  constructor(
    private readonly provider: DatabaseProvider,
    private readonly dialect: Dialect = provider.providerLabel as Dialect
  ) {}

  public async ensureExists(): Promise<void> {
    await this.provider.executeNonQuery(buildEnsureMigrationsTableSql(this.dialect));
  }

  public async list(): Promise<MigrationRecord[]> {
    // Distinguish "table genuinely absent" (→ []) from "query failed on an existing table"
    // (→ propagate). A swallowed query error here would make a failing DB look like
    // "no migrations applied" and silently re-run already-applied migrations.
    if (!(await this.tableExists())) {
      return [];
    }

    const rows = await this.provider.executeQuery<MigrationRow>(
      `SELECT version, name, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY version`
    );

    return rows.map((row) => ({
      version: row.version,
      name: row.name,
      appliedAt: new Date(row.applied_at)
    }));
  }

  public async record(version: string, name: string, appliedAt: Date): Promise<void> {
    await this.provider.executeNonQuery(
      `INSERT INTO ${MIGRATIONS_TABLE} (version, name, applied_at) VALUES (?, ?, ?)`,
      [version, name, appliedAt.toISOString()]
    );
  }

  public async remove(version: string): Promise<void> {
    await this.provider.executeNonQuery(`DELETE FROM ${MIGRATIONS_TABLE} WHERE version = ?`, [
      version
    ]);
  }

  /**
   * Probes `information_schema.tables` for the bookkeeping table.
   *
   * `information_schema.tables` is portable across PostgreSQL, MySQL, and SQL Server. A failure
   * of the probe itself (connection/permission) propagates — it is a genuine error, not a
   * "table absent" signal.
   *
   * The fixed `MIGRATIONS_TABLE` constant is embedded as a literal rather than bound as a `?`
   * parameter: `executeQuery` does not run dialect placeholder normalization (`?` → `$n`/`@pn`),
   * and the value is an internal constant — never user input — so there is no injection surface.
   */
  private async tableExists(): Promise<boolean> {
    const rows = await this.provider.executeQuery<Record<string, unknown>>(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = '${MIGRATIONS_TABLE}'`
    );

    if (rows.length === 0) {
      return false;
    }

    // COUNT(*) comes back as number (MySQL/MSSQL) or string (PostgreSQL bigint); read positionally
    // to avoid per-dialect column-casing assumptions.
    const count = Object.values(rows[0])[0];
    return Number(count) > 0;
  }
}
