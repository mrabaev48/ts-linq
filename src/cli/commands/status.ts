import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import { makeEffectiveConfig } from '../runtime/config';
import { MigrationRunner } from '../../migrations/MigrationRunner';
import { SQLiteProvider } from '../../providers/SQLiteProvider';
import { PostgresProvider } from '../../providers/PostgresProvider';
import { MySqlProvider } from '../../providers/MySqlProvider';
import { MssqlProvider } from '../../providers/MssqlProvider';
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

export class StatusCommand implements Command {
  public async execute(_rest: string[], flags: Flags): Promise<number> {
    const logger = new ConsoleLogger();
    const effective = makeEffectiveConfig(flags);
    const provider = createProvider(effective.provider, effective.connectionString);
    await provider.connect();
    const runner = new MigrationRunner(provider);
    await runner.ensureMigrationTableExists();
    const list = await runner.getAppliedMigrations();
    await provider.disconnect();
    if (flags.json) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ provider: effective.provider, applied: list }, null, 2));
    } else if (!flags.quiet) {
      if (list.length === 0) {
        logger.log('info', 'No migrations applied');
      } else {
        for (const m of list) {
          logger.log('info', `${m.version} ${m.name} @ ${m.appliedAt.toISOString()}`);
        }
      }
    }
    return 0;
  }
}
