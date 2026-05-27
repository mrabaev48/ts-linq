import type { DatabaseProvider } from '@ts-linq/core';

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
    const sql = this.buildEnsureTableSql(this._provider.providerLabel as string);
    await this._provider.executeNonQuery(sql);
  }

  private buildEnsureTableSql(dialect: string): string {
    if (dialect === 'mssql') {
      return `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__migrations')
BEGIN
    CREATE TABLE __migrations (
        version NVARCHAR(50) NOT NULL PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        applied_at NVARCHAR(50) NOT NULL
    )
END`;
    }
    // PostgreSQL, MySQL, SQLite — use standard IF NOT EXISTS syntax.
    // MySQL requires VARCHAR with explicit length for indexed/primary-key columns.
    const vt = dialect === 'mysql' ? 'VARCHAR(50)' : 'TEXT';
    const nt = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT';
    const dt = dialect === 'mysql' ? 'VARCHAR(50)' : 'TEXT';
    return `
CREATE TABLE IF NOT EXISTS __migrations (
    version ${vt} PRIMARY KEY,
    name ${nt} NOT NULL,
    applied_at ${dt} NOT NULL
)`;
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
