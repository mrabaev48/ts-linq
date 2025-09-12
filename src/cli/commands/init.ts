import * as path from 'path';
import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import type { CliConfig } from '../runtime/types';
import { ConsoleLogger, NodeFsPort } from '../runtime/nodeAdapters';

export class InitCommand implements Command {
  public async execute(_rest: string[], flags: Flags): Promise<number> {
    const cwd = flags.cwd || process.cwd();
    const fsp = new NodeFsPort();
    const logger = new ConsoleLogger();
    const cfgPath = path.resolve(cwd, 'tslinq.config.json');
    const migrationsDir = path.resolve(cwd, 'migrations');
    const seedsDir = path.resolve(cwd, 'seeds');

    if (!fsp.exists(cfgPath)) {
      const cfg = {
        provider: 'sqlite',
        connectionString: ':memory:',
        migrationsDir: 'migrations',
        seedsDir: 'seeds',
        entitiesGlobs: []
      } as CliConfig;
      fsp.writeText(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
      if (!flags.quiet) logger.log('info', `Created ${cfgPath}`);
    } else if (!flags.quiet) {
      logger.log('info', `Config already exists: ${cfgPath}`);
    }

    if (!fsp.exists(migrationsDir)) {
      fsp.mkdirp(migrationsDir);
      if (!flags.quiet) logger.log('info', `Created ${migrationsDir}`);
    }
    if (!fsp.exists(seedsDir)) {
      fsp.mkdirp(seedsDir);
      if (!flags.quiet) logger.log('info', `Created ${seedsDir}`);
    }

    const seedsSql = path.join(seedsDir, 'seeds.sql');
    if (!fsp.exists(seedsSql)) {
      fsp.writeText(
        seedsSql,
        '-- Example seed file\n-- CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL);\n'
      );
      if (!flags.quiet) logger.log('info', `Created ${seedsSql}`);
    }
    return 0;
  }
}


