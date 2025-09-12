import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import { makeEffectiveConfig } from '../runtime/config';
import { loadBootstrapFiles, loadEntitiesFromGlobs } from '../runtime/bootstrap';
import { DiffMigrationGenerator } from '../../migrations/DiffMigrationGenerator';
import { MigrationRunner } from '../../migrations/MigrationRunner';
import type { Migration } from '../../migrations/Migration';
import { SQLiteProvider } from '../../providers/SQLiteProvider';
import { PostgresProvider } from '../../providers/PostgresProvider';
import { MySqlProvider } from '../../providers/MySqlProvider';
import { MssqlProvider } from '../../providers/MssqlProvider';
import * as fs from 'fs';
import * as path from 'path';
import { ConsoleLogger } from '../runtime/nodeAdapters';

function createProvider(id: 'sqlite' | 'postgresql' | 'mysql' | 'mssql', conn: string) {
  switch (id) {
    case 'sqlite':
      return new SQLiteProvider(conn);
    case 'postgresql':
      return new PostgresProvider(conn);
    case 'mysql':
      return new MySqlProvider(conn);
    case 'mssql':
      return new MssqlProvider(conn);
    default:
      return new SQLiteProvider(conn);
  }
}

async function tryLoadMigrations(
  migrationsDir: string,
  provider: ReturnType<typeof createProvider>
): Promise<Migration[] | undefined> {
  const indexCandidates = ['index.ts', 'index.js', 'index.cjs', 'index.mjs'];
  for (const name of indexCandidates) {
    const p = path.resolve(migrationsDir, name);
    if (!fs.existsSync(p)) continue;
    if (name.endsWith('.ts')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('ts-node/register/transpile-only');
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(p) as
      | { default?: unknown; loadMigrations?: (provider: unknown) => Promise<Migration[] | Migration[]> }
      | undefined;
    if (!mod) continue;
    const loader = (mod as { loadMigrations?: (provider: unknown) => Promise<Migration[] | Migration[]> })
      .loadMigrations;
    if (typeof loader === 'function') {
      const res = await Promise.resolve(loader(provider));
      return Array.isArray(res) ? (res as Migration[]) : undefined;
    }
    const def = (mod as { default?: unknown }).default;
    if (Array.isArray(def)) {
      return def as Migration[];
    }
  }
  return undefined;
}

export class MigrateCommand implements Command {
  public async execute(_rest: string[], flags: Flags): Promise<number> {
    const logger = new ConsoleLogger();
    const effective = makeEffectiveConfig(flags);
    await loadBootstrapFiles(effective.bootstrap, flags.cwd || process.cwd());
    await loadEntitiesFromGlobs(effective.entitiesGlobs, flags.cwd || process.cwd());
    const provider = createProvider(effective.provider, effective.connectionString);
    await provider.connect();
    const explicit = await tryLoadMigrations(effective.migrationsDir, provider);
    if (explicit && explicit.length > 0) {
      const runner = new MigrationRunner(provider);
      await runner.ensureMigrationTableExists();
      const applied = await runner.getAppliedMigrations();
      const appliedSet = new Set(applied.map((a) => a.version));
      const sorted = [...explicit].sort((a, b) => a.getVersion().localeCompare(b.getVersion()));
      let pending = sorted.filter((m) => !appliedSet.has(m.getVersion()));
      if (flags.toVersion) {
        pending = pending.filter((m) => m.getVersion() <= flags.toVersion!);
      }
      if (typeof flags.step === 'number' && Number.isFinite(flags.step) && flags.step! > 0) {
        pending = pending.slice(0, flags.step);
      }
      if (flags.dryRun) {
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            { applied: applied.map((a) => a.version), pending: pending.map((m) => m.getVersion()) },
            null,
            2
          )
        );
      } else {
        for (const m of pending) runner.addMigration(m);
        if (flags.verbose && !flags.quiet) {
          logger.log('info', `Applying ${pending.length} migration(s)`);
        }
        await runner.migrate();
      }
      await provider.disconnect();
      return 0;
    }
    // Fallback: diff
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    if (flags.dryRun) {
      if (flags.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ steps: steps.map((s) => s.sql) }, null, 2));
      } else {
        for (const step of steps) {
          // eslint-disable-next-line no-console
          console.log(step.sql);
        }
      }
      await provider.disconnect();
      return 0;
    }
    for (const step of steps) {
      if (!step.sql.trim().startsWith('--')) {
        if (flags.verbose && !flags.quiet) {
          logger.log('info', `EXEC: ${step.sql}`);
        }
        // eslint-disable-next-line no-await-in-loop
        await provider.executeNonQuery(step.sql);
      }
    }
    if (!flags.quiet) {
      logger.log('info', `Applied ${steps.length} step(s).`);
    }
    await provider.disconnect();
    return 0;
  }
}


