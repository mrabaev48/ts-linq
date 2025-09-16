import * as path from 'path';
import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import { makeEffectiveConfig } from '../runtime/config';
import { NodeFsPort, ConsoleLogger } from '../runtime/nodeAdapters';
import { SQLiteProvider } from '../../providers/SQLiteProvider';
import { PostgresProvider } from '../../providers/PostgresProvider';
import { MySqlProvider } from '../../providers/MySqlProvider';
import { MssqlProvider } from '../../providers/MssqlProvider';

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

export class SeedCommand implements Command {
  public async execute(rest: string[], flags: Flags): Promise<number> {
    const fsp = new NodeFsPort();
    const logger = new ConsoleLogger();
    const effective = makeEffectiveConfig(flags || {});
    if (!flags.yes && !flags.dryRun && !flags.quiet) {
      // eslint-disable-next-line no-console
      console.warn('Seeding may modify data. Pass --yes to suppress this warning.');
    }
    const provider = createProvider(effective.provider, effective.connectionString);
    await provider.connect();
    const startedAt = Date.now();
    const defaultSeed = path.resolve(effective.seedsDir, 'seeds.sql');
    const fileArg = flags.file || rest[0];
    const sqlFile = fileArg ? path.resolve(process.cwd(), fileArg) : defaultSeed;
    if (!fsp.exists(sqlFile)) {
      // eslint-disable-next-line no-console
      console.error(`Seed file not found: ${sqlFile}`);
      await provider.disconnect();
      return 2;
    }
    if (sqlFile.endsWith('.ts') || sqlFile.endsWith('.js')) {
      // Dynamic import for TS/JS seed script
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(sqlFile);
      const runner: unknown = mod.run || mod.default;
      if (typeof runner !== 'function') {
        console.error(`Seed script must export async function run(provider): ${sqlFile}`);
        await provider.disconnect();
        return 2;
      }
      if (!flags.dryRun) {
        if (flags.transaction) await provider.beginTransaction();
        try {
          await Promise.resolve((runner as (p: unknown) => Promise<void>)(provider));
          if (flags.transaction) await provider.commitTransaction();
          if (flags.json) {
            // eslint-disable-next-line no-console
            console.log(JSON.stringify({ ok: true, file: sqlFile, script: true, durationMs: Date.now() - startedAt }, null, 2));
          }
        } catch (e) {
          if (flags.transaction) await provider.rollbackTransaction();
          throw e;
        }
      } else if (!flags.quiet) {
        if (flags.json) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify({ ok: true, file: sqlFile, script: true, dryRun: true, durationMs: 0 }, null, 2));
        } else {
          logger.log('info', `Dry-run: would execute seed script ${sqlFile}`);
        }
      }
    } else {
      const text = fsp.readText(sqlFile);
      const statements = text
        .split(';')
        .map((stmt) => stmt.trim())
        .filter(Boolean);
      if (!flags.dryRun) {
        if (flags.transaction) await provider.beginTransaction();
        try {
          for (const statement of statements) {
            // eslint-disable-next-line no-await-in-loop
            await provider.executeNonQuery(statement);
          }
          if (flags.transaction) await provider.commitTransaction();
        } catch (e) {
          if (flags.transaction) await provider.rollbackTransaction();
          throw e;
        }
      } else if (!flags.quiet) {
        logger.log('info', `Dry-run: would execute ${statements.length} statements from ${sqlFile}`);
      }
      if (flags.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ ok: true, file: sqlFile, statements: statements.length, durationMs: Date.now() - startedAt }, null, 2));
      } else if (!flags?.quiet) {
        logger.log('info', `Applied ${statements.length} seed statements from ${sqlFile}`);
      }
    }
    await provider.disconnect();
    return 0;
  }
}


