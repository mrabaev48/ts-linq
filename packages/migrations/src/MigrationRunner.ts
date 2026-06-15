import type { DatabaseProvider } from '@ts-linq/core';
import { MigrationApplyError, MigrationRollbackError } from '@ts-linq/types';

import type { Migration } from './Migration';
import { DefaultMigrationHistoryStore } from './runner/DefaultMigrationHistoryStore';
import type { MigrationHistoryStore, MigrationRecord } from './runner/MigrationHistoryStore';
import { type MigrationLogger, NO_OP_LOGGER } from './runner/MigrationLogger';
import { TransactionScope } from './runner/TransactionScope';

export type { MigrationRecord } from './runner/MigrationHistoryStore';

/**
 * Injectable collaborators for {@link MigrationRunner}.
 *
 * All optional: any omitted collaborator is built from the provider, so `new
 * MigrationRunner(provider)` keeps working. Supply a fake `historyStore`/`transactionScope` to
 * unit-test orchestration without a live database, or a `logger` to surface progress.
 */
export interface MigrationRunnerOptions {
  historyStore?: MigrationHistoryStore;
  transactionScope?: TransactionScope;
  logger?: MigrationLogger;
}

/**
 * Orchestrates applying pending migrations in order and rolling back to a target version.
 *
 * The runner is a thin use-case layer: persistence is delegated to a {@link MigrationHistoryStore}
 * (Repository), transactional safety to a {@link TransactionScope} (Scoped Resource), and progress
 * reporting to an injected {@link MigrationLogger} (no `console` in the library). Failures are
 * surfaced as the typed {@link MigrationApplyError}/{@link MigrationRollbackError} with the original
 * error preserved as `cause`.
 */
export class MigrationRunner {
  private readonly _historyStore: MigrationHistoryStore;
  private readonly _transactionScope: TransactionScope;
  private readonly _logger: MigrationLogger;
  private _migrations: Migration[] = [];

  constructor(provider: DatabaseProvider, options: MigrationRunnerOptions = {}) {
    this._historyStore = options.historyStore ?? new DefaultMigrationHistoryStore(provider);
    this._transactionScope = options.transactionScope ?? new TransactionScope(provider);
    this._logger = options.logger ?? NO_OP_LOGGER;
  }

  /** Register a migration to be considered during `migrate()`. */
  public addMigration(migration: Migration): void {
    this._migrations.push(migration);
    this._migrations.sort((a, b) => a.getVersion().localeCompare(b.getVersion()));
  }

  /** Ensure the migrations bookkeeping table exists. */
  public async ensureMigrationTableExists(): Promise<void> {
    await this._historyStore.ensureExists();
  }

  /** Read the list of applied migrations from the database. */
  public async getAppliedMigrations(): Promise<MigrationRecord[]> {
    return this._historyStore.list();
  }

  /** Apply all pending migrations in order. */
  public async migrate(): Promise<void> {
    await this.ensureMigrationTableExists();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map((m) => m.version));

    for (const migration of this._migrations) {
      if (appliedVersions.has(migration.getVersion())) {
        continue;
      }

      const version = migration.getVersion();
      const name = migration.getName();
      this._logger.info(`Applying migration: ${name}`);

      try {
        await this._transactionScope.run(async () => {
          await migration.up();
          await this._historyStore.record(version, name, new Date());
        });
      } catch (error) {
        throw MigrationApplyError.from(version, name, error);
      }

      this._logger.info(`Migration ${name} applied successfully`);
    }
  }

  /** Roll back applied migrations down to (but not including) targetVersion. */
  public async rollback(targetVersion?: string): Promise<void> {
    await this.ensureMigrationTableExists();
    const appliedMigrations = await this.getAppliedMigrations();

    // Sort in reverse order for rollback.
    appliedMigrations.reverse();

    for (const appliedMigration of appliedMigrations) {
      if (targetVersion && appliedMigration.version <= targetVersion) {
        break;
      }

      const migration = this._migrations.find((m) => m.getVersion() === appliedMigration.version);
      if (!migration) {
        continue;
      }

      const version = migration.getVersion();
      const name = migration.getName();
      this._logger.info(`Rolling back migration: ${name}`);

      try {
        await this._transactionScope.run(async () => {
          await migration.down();
          await this._historyStore.remove(version);
        });
      } catch (error) {
        throw MigrationRollbackError.from(version, name, error);
      }

      this._logger.info(`Migration ${name} rolled back successfully`);
    }
  }
}
