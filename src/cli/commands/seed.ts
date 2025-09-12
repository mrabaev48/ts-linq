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
    const provider = createProvider(effective.provider, effective.connectionString);
    await provider.connect();
    const defaultSeed = path.resolve(effective.seedsDir, 'seeds.sql');
    const fileArg = rest[0];
    const sqlFile = fileArg ? path.resolve(process.cwd(), fileArg) : defaultSeed;
    if (!fsp.exists(sqlFile)) {
      // eslint-disable-next-line no-console
      console.error(`Seed file not found: ${sqlFile}`);
      await provider.disconnect();
      return 2;
    }
    const text = fsp.readText(sqlFile);
    const statements = text
      .split(';')
      .map((stmt) => stmt.trim())
      .filter(Boolean);
    for (const statement of statements) {
      // eslint-disable-next-line no-await-in-loop
      await provider.executeNonQuery(statement);
    }
    if (!flags?.quiet) logger.log('info', `Applied ${statements.length} seed statements from ${sqlFile}`);
    await provider.disconnect();
    return 0;
  }
}


