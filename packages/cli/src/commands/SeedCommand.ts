import type { DatabaseProvider } from '@ts-linq/core';
import * as path from 'path';

import { ConsoleLogger } from '../adapters/ConsoleLogger';
import { NodeFs } from '../adapters/NodeFs';
import type { FileSystem } from '../ports/FileSystem';
import type { Logger } from '../ports/Logger';
import type { DbCommand } from './Command';

export class SeedCommand implements DbCommand {
  public readonly name = 'seed';
  public readonly describe = 'Executes SQL from a file to seed initial data';
  public readonly aliases = ['db:seed'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async runDb(provider: DatabaseProvider, argv: string[]): Promise<void> {
    const sqlFile = argv[1] || path.resolve(process.cwd(), 'seeds.sql');
    if (!this.fsAdapter.exists(sqlFile)) {
      this.logger.error(`Seed file not found: ${sqlFile}`);
      process.exitCode = 2;
      return;
    }
    const text = this.fsAdapter.readText(sqlFile);
    const statements = text
      .split(';')
      .map((stmt: string) => stmt.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await provider.executeNonQuery(statement);
    }
    this.logger.info(`Applied ${statements.length} seed statements from ${sqlFile}`);
  }
}
