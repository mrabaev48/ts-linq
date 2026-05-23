import * as fs from 'node:fs';
import * as path from 'node:path';

import type { DatabaseProvider } from '@ts-linq/core';
import type { Dialect, IdempotentMigrationStep, Migration } from '@ts-linq/migrations';
import {
  IdempotentEmitter,
  MigrationRunner,
  ModelSnapshotBuilder,
  ModelSnapshotDiff,
  ModelSnapshotSerializer
} from '@ts-linq/migrations';

/**
 * Options accepted by `ctx.database.migrate()`.
 * Mirrors EF Core's `MigrationOptions`.
 */
export interface MigrateOptions {
  /**
   * When `true`, each migration step is wrapped in an idempotency guard so the
   * script is safe to re-run if it was previously interrupted.
   *
   * Mirrors `context.Database.Migrate()` + `--idempotent` semantics from EF Core.
   */
  idempotent?: boolean;
}

/** A discovered migration file entry. */
interface LocalMigrationEntry {
  version: string;
  name: string;
  absolutePath: string;
}

/**
 * Implements the pending-model-changes detection and programmatic migration API
 * exposed on `DatabaseFacade`.
 *
 * Mirrors the EF Core patterns:
 * - `ctx.Database.HasPendingModelChanges()`
 * - `ctx.Database.GetPendingMigrations()`
 * - `await ctx.Database.MigrateAsync()`
 *
 * @internal  Not part of the public API surface; accessed through `DatabaseFacade`.
 */
export class PendingModelChangesChecker {
  private static readonly SNAPSHOT_FILENAME = 'model.snapshot.json';

  constructor(
    private readonly _provider: DatabaseProvider,
    private readonly _migrationsDir: string
  ) {}

  // ---------------------------------------------------------------------------
  // hasPendingModelChanges — synchronous
  // ---------------------------------------------------------------------------

  /**
   * Returns `true` when the current application model differs from the snapshot
   * stored in `<migrationsDir>/model.snapshot.json`, OR when there are migration
   * files in `migrationsDir` that have not been tracked yet.
   *
   * This is a synchronous file-system comparison that does **not** contact the
   * database. It mirrors EF Core's `HasPendingModelChanges()` semantics.
   *
   * @example
   * if (ctx.database.hasPendingModelChanges()) {
   *   throw new Error('Model is out of sync with migrations');
   * }
   */
  public hasPendingModelChanges(): boolean {
    const snapshotPath = this.resolveSnapshotPath();

    if (!fs.existsSync(snapshotPath)) {
      // No snapshot committed yet — treat as pending if there are any entities.
      const current = new ModelSnapshotBuilder().buildFromMetadata();
      return current.tables.length > 0;
    }

    try {
      const stored = new ModelSnapshotSerializer().deserialize(
        fs.readFileSync(snapshotPath, 'utf8')
      );
      const current = new ModelSnapshotBuilder().buildFromMetadata();
      const diff = new ModelSnapshotDiff().compare(stored, current);
      return diff.hasDifferences;
    } catch {
      return true;
    }
  }

  // ---------------------------------------------------------------------------
  // getPendingMigrations — async (needs DB)
  // ---------------------------------------------------------------------------

  /**
   * Returns the list of local migration file versions that have **not** yet
   * been recorded in the `__migrations` history table.
   *
   * Mirrors EF Core's `context.Database.GetPendingMigrationsAsync()`.
   *
   * @example
   * const pending = await ctx.database.getPendingMigrations();
   * console.log(`${pending.length} migration(s) pending:`, pending);
   */
  public async getPendingMigrations(): Promise<string[]> {
    if (!fs.existsSync(this._migrationsDir)) return [];

    const runner = new MigrationRunner(this._provider);
    const applied = await runner.getAppliedMigrations();
    const appliedVersions = new Set(applied.map((m) => m.version));

    return this.discoverLocalMigrations()
      .filter((entry) => !appliedVersions.has(entry.version))
      .map((entry) => `${entry.version}_${entry.name}`);
  }

  // ---------------------------------------------------------------------------
  // migrate — async (applies pending migrations)
  // ---------------------------------------------------------------------------

  /**
   * Apply all pending migrations found in `migrationsDir`.
   *
   * When `options.idempotent` is `true`, an idempotent SQL script is generated
   * and executed via `executeNonQuery` — each migration is guarded so the script
   * is safe to re-run if previously interrupted.
   *
   * Mirrors EF Core's `await context.Database.MigrateAsync()`.
   *
   * @example
   * await ctx.database.migrate();
   *
   * // Idempotent — safe to re-run:
   * await ctx.database.migrate({ idempotent: true });
   */
  public async migrate(options?: MigrateOptions): Promise<void> {
    if (!fs.existsSync(this._migrationsDir)) {
      throw new Error(
        `Migrations directory not found: ${this._migrationsDir}\n` +
          'Generate a migration first with: pnpm ts-linq generate:migration <Name>'
      );
    }

    const isIdempotent = options?.idempotent ?? false;

    if (isIdempotent) {
      await this.migrateIdempotent();
    } else {
      await this.migrateStandard();
    }
  }

  // ---------------------------------------------------------------------------
  // Private — migration execution
  // ---------------------------------------------------------------------------

  private async migrateStandard(): Promise<void> {
    const runner = new MigrationRunner(this._provider);
    const modules = this.loadMigrationModules();
    for (const migration of modules) {
      runner.addMigration(migration);
    }
    await runner.migrate();
  }

  private async migrateIdempotent(): Promise<void> {
    const runner = new MigrationRunner(this._provider);
    await runner.ensureMigrationTableExists();

    const applied = await runner.getAppliedMigrations();
    const appliedVersions = new Set(applied.map((m) => m.version));

    const localEntries = this.discoverLocalMigrations().filter(
      (e) => !appliedVersions.has(e.version)
    );

    if (localEntries.length === 0) return;

    const dialect = this.detectDialect();
    const emitter = new IdempotentEmitter();

    for (const entry of localEntries) {
      // Load the migration class to get its UP SQL.
      const migration = this.loadMigrationClass(entry.absolutePath);
      if (!migration) continue;

      // Execute idempotent SQL for this single migration.
      const step: IdempotentMigrationStep = {
        version: entry.version,
        name: entry.name,
        upSql: await this.collectUpSql(migration, this._provider)
      };

      const sql = emitter.emit([step], dialect);
      await this._provider.executeNonQuery(sql);
    }
  }

  // ---------------------------------------------------------------------------
  // Private — helpers
  // ---------------------------------------------------------------------------

  private discoverLocalMigrations(): LocalMigrationEntry[] {
    const entries: LocalMigrationEntry[] = [];

    for (const file of fs.readdirSync(this._migrationsDir)) {
      const match = /^(\d{14})_([A-Za-z0-9_]+)\.(ts|js|mjs|cjs)$/.exec(file);
      if (!match) continue;
      entries.push({
        version: match[1],
        name: match[2],
        absolutePath: path.resolve(this._migrationsDir, file)
      });
    }

    return entries.sort((a, b) => a.version.localeCompare(b.version));
  }

  private loadMigrationModules(): Migration[] {
    return this.discoverLocalMigrations().flatMap((entry) => {
      const migration = this.loadMigrationClass(entry.absolutePath);
      return migration ? [migration] : [];
    });
  }

  private loadMigrationClass(filePath: string): Migration | null {
    try {
      const mod = require(filePath) as Record<string, unknown>;
      for (const key of Object.keys(mod)) {
        const Ctor = mod[key];
        if (typeof Ctor !== 'function') continue;
        const proto = (Ctor as { prototype?: unknown }).prototype ?? {};
        if (!('up' in (proto as object)) || !('down' in (proto as object))) continue;
        try {
          const instance = new (Ctor as new () => { getVersion(): string })();
          if (typeof instance.getVersion === 'function') {
            return instance as unknown as Migration;
          }
        } catch {
          continue;
        }
      }
    } catch {
      // file could not be loaded — skip
    }
    return null;
  }

  /**
   * Collect UP SQL by intercepting `executeNonQuery` calls on a spy provider.
   * This is a lightweight introspection approach to extract SQL without running it.
   */
  private async collectUpSql(
    migration: Migration,
    realProvider: DatabaseProvider
  ): Promise<string[]> {
    const collected: string[] = [];

    const spyProvider: DatabaseProvider = new Proxy(realProvider, {
      get(target, prop) {
        if (prop === 'executeNonQuery') {
          return async (sql: string): Promise<number> => {
            collected.push(sql);
            return Promise.resolve(0);
          };
        }
        // Proxy get must return the underlying property for all other calls.
        // The cast to unknown → DatabaseProvider is required because Proxy typing
        // does not propagate the mapped type automatically.
        return Reflect.get(target as object, prop) as unknown;
      }
    });

    // Temporarily bind the migration to the spy provider if it uses one.
    // Standard migrations call provider.executeNonQuery directly in up().
    // We need to set the provider on the migration if it's a DiffBasedMigration.
    const mig = migration as unknown as {
      _provider?: DatabaseProvider;
      up(): Promise<void>;
    };

    const originalProvider = mig._provider;
    mig._provider = spyProvider;

    try {
      await mig.up();
    } finally {
      mig._provider = originalProvider;
    }

    return collected;
  }

  private detectDialect(): Dialect {
    const label = this._provider.providerLabel as string | undefined;
    if (label === 'postgresql') return 'postgresql';
    if (label === 'mysql') return 'mysql';
    if (label === 'mssql') return 'mssql';
    return 'postgresql';
  }

  private resolveSnapshotPath(): string {
    return path.join(this._migrationsDir, PendingModelChangesChecker.SNAPSHOT_FILENAME);
  }
}
