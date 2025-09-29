import * as path from 'path';
import type { DatabaseProvider } from '@ts-linq/core';
import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import { ConsoleLogger } from '../adapters/ConsoleLogger';
import type { FileSystem } from '../ports/FileSystem';
import { NodeFs } from '../adapters/NodeFs';

export class SeedCommand implements Command {
  public readonly name = 'seed';
  public readonly describe = 'Выполняет SQL из файла для начального наполнения';
  public readonly requiresProvider = true;
  public readonly aliases = ['db:seed'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async run(provider: DatabaseProvider | null, argv: string[]): Promise<void> {
    if (!provider) throw new Error('Provider is required');
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
      // eslint-disable-next-line no-await-in-loop
      await provider.executeNonQuery(statement);
    }
    this.logger.info(`Applied ${statements.length} seed statements from ${sqlFile}`);
  }
}
