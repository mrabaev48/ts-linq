import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import { makeEffectiveConfig } from '../runtime/config';
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

export class RollbackCommand implements Command {
  public async execute(_rest: string[], flags: Flags): Promise<number> {
    const logger = new ConsoleLogger();
    const effective = makeEffectiveConfig(flags);
    const provider = createProvider(effective.provider, effective.connectionString);
    await provider.connect();
    const explicit = await tryLoadMigrations(effective.migrationsDir, provider);
    const runner = new MigrationRunner(provider);
    if (explicit) for (const m of explicit) runner.addMigration(m);
    await runner.ensureMigrationTableExists();
    await runner.rollback(flags.toVersion);
    if (!flags.quiet) logger.log('info', 'Rollback completed');
    await provider.disconnect();
    return 0;
  }
}


