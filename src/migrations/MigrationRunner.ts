import type { DatabaseProvider } from '../providers/DatabaseProvider';
import type { Migration } from './Migration';

/**
 * A record stored in the migrations table representing an applied migration.
 */
export interface MigrationRecord {
  version: string;
  name: string;
  appliedAt: Date;
}

/**
 * Executes pending migrations in order and can roll back to a target version.
 */
export class MigrationRunner {
  private _provider: DatabaseProvider;
  private _migrations: Migration[] = [];
  private _lockTaken: boolean = false;

  constructor(provider: DatabaseProvider) {
    this._provider = provider;
  }

  /** Register a migration to be considered during `migrate()`. */
  public addMigration(migration: Migration): void {
    this._migrations.push(migration);
    this._migrations.sort((a, b) => a.getVersion().localeCompare(b.getVersion()));
  }

  /** Ensure the migrations bookkeeping table exists. */
  public async ensureMigrationTableExists(): Promise<void> {
    const sql = `
            CREATE TABLE IF NOT EXISTS __migrations (
                version TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at TEXT NOT NULL
            )
        `;
    await this._provider.executeNonQuery(sql);
  }

  /** Read the list of applied migrations from the database. */
  public async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      const results = await this._provider.executeQuery<{
        version: string;
        name: string;
        applied_at: string;
      }>('SELECT version, name, applied_at FROM __migrations ORDER BY version');

      return results.map((row) => ({
        version: row.version,
        name: row.name,
        appliedAt: new Date(row.applied_at)
      }));
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  /** Apply all pending migrations in order. */
  public async migrate(): Promise<void> {
    await this.ensureMigrationTableExists();
    await this.acquireLock();
    try {
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedVersions = new Set(appliedMigrations.map((m) => m.version));

      for (const migration of this._migrations) {
        if (!appliedVersions.has(migration.getVersion())) {
          console.log(`Applying migration: ${migration.getName()}`);

          try {
            await this._provider.beginTransaction();
            await migration.up();

            await this._provider.executeNonQuery(
              'INSERT INTO __migrations (version, name, applied_at) VALUES (?, ?, ?)',
              [migration.getVersion(), migration.getName(), new Date().toISOString()]
            );

            await this._provider.commitTransaction();
            console.log(`Migration ${migration.getName()} applied successfully`);
          } catch (error) {
            await this._provider.rollbackTransaction();
            throw new Error(`Failed to apply migration ${migration.getName()}: ${error}`);
          }
        }
      }
    } finally {
      await this.releaseLock();
    }
  }

  /** Roll back applied migrations down to (but not including) targetVersion. */
  public async rollback(targetVersion?: string): Promise<void> {
    await this.ensureMigrationTableExists();
    await this.acquireLock();
    try {
      const appliedMigrations = await this.getAppliedMigrations();

      // Sort in reverse order for rollback
      appliedMigrations.reverse();

      for (const appliedMigration of appliedMigrations) {
        if (targetVersion && appliedMigration.version <= targetVersion) {
          break;
        }

        const migration = this._migrations.find((m) => m.getVersion() === appliedMigration.version);
        if (migration) {
          console.log(`Rolling back migration: ${migration.getName()}`);

          try {
            await this._provider.beginTransaction();
            await migration.down();

            await this._provider.executeNonQuery('DELETE FROM __migrations WHERE version = ?', [
              migration.getVersion()
            ]);

            await this._provider.commitTransaction();
            console.log(`Migration ${migration.getName()} rolled back successfully`);
          } catch (error) {
            await this._provider.rollbackTransaction();
            throw new Error(`Failed to rollback migration ${migration.getName()}: ${error}`);
          }
        }
      }
    } finally {
      await this.releaseLock();
    }
  }

  private async acquireLock(): Promise<void> {
    if (this._lockTaken) return;
    const id = (this._provider as unknown as { providerLabel?: string }).providerLabel || 'unknown';
    try {
      if (id === 'postgresql') {
        const rows = await this._provider.executeQuery<{ locked: boolean }>(
          'SELECT pg_try_advisory_lock(4815162342) AS locked'
        );
        if (!rows[0] || rows[0].locked !== true) throw new Error('pg_try_advisory_lock failed');
        this._lockTaken = true;
      } else if (id === 'mysql') {
        const rows = await this._provider.executeQuery<{ r: number }>(
          "SELECT GET_LOCK('tslinq_migrate', 0) AS r"
        );
        if (!rows[0] || rows[0].r !== 1) throw new Error('GET_LOCK failed');
        this._lockTaken = true;
      } else if (id === 'mssql') {
        const rows = await this._provider.executeQuery<{ res: number }>(
          "DECLARE @res int; EXEC @res = sp_getapplock @Resource='tslinq_migrate', @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=0; SELECT @res as res;"
        );
        const res = rows[0]?.res;
        if (typeof res !== 'number' || res < 0) throw new Error('sp_getapplock failed');
        this._lockTaken = true;
      } else {
        // SQLite/unknown: no-op
        this._lockTaken = false;
      }
    } catch (e) {
      throw new Error(`Failed to acquire migration lock: ${String((e as Error)?.message || e)}`);
    }
  }

  private async releaseLock(): Promise<void> {
    if (!this._lockTaken) return;
    const id = (this._provider as unknown as { providerLabel?: string }).providerLabel || 'unknown';
    try {
      if (id === 'postgresql') {
        await this._provider.executeNonQuery('SELECT pg_advisory_unlock(4815162342)');
      } else if (id === 'mysql') {
        await this._provider.executeNonQuery("SELECT RELEASE_LOCK('tslinq_migrate')");
      } else if (id === 'mssql') {
        await this._provider.executeNonQuery(
          "DECLARE @res int; EXEC @res = sp_releaseapplock @Resource='tslinq_migrate', @LockOwner='Session'; SELECT @res as res;"
        );
      }
    } finally {
      this._lockTaken = false;
    }
  }
}
