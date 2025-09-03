import { DatabaseProvider } from '../providers/DatabaseProvider';
import { Migration } from './Migration';

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
      const results = await this._provider.executeQuery<any>(
        'SELECT version, name, applied_at FROM __migrations ORDER BY version'
      );

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
  }

  /** Roll back applied migrations down to (but not including) targetVersion. */
  public async rollback(targetVersion?: string): Promise<void> {
    await this.ensureMigrationTableExists();
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
  }
}
