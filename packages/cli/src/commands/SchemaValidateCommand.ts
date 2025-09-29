import * as path from 'path';
import type { DatabaseProvider } from '@ts-linq/core';
import {
  SchemaSnapshotBuilder,
  SchemaSnapshotSerializer,
  generateMigrationFromDiff
} from '@ts-linq/core';
import { compareSchemas } from '@ts-linq/core';
import { resolveDialect } from '../utils';
import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import { ConsoleLogger } from '../adapters/ConsoleLogger';
import type { FileSystem } from '../ports/FileSystem';
import { NodeFs } from '../adapters/NodeFs';

export class SchemaValidateCommand implements Command {
  public readonly name = 'schema:validate';
  public readonly describe = 'Проверяет, что БД соответствует snapshot';
  public readonly requiresProvider = true;
  public readonly aliases = ['schema validate'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async run(provider: DatabaseProvider | null, argv: string[]): Promise<void> {
    if (!provider) throw new Error('Provider is required');
    const file = argv[1] || path.resolve(process.cwd(), 'schema.snapshot.json');
    if (!this.fsAdapter.exists(file)) {
      this.logger.error(`Snapshot file not found: ${file}`);
      process.exitCode = 2;
      return;
    }
    const target = new SchemaSnapshotSerializer().deserialize(this.fsAdapter.readText(file));
    const actual = await new SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
    const diff = compareSchemas(target, actual);
    const rendered = generateMigrationFromDiff(diff, resolveDialect(provider.providerLabel));
    if (rendered.up.length > 0) {
      this.logger.error(`Schema drift detected: ${rendered.up.length} change(s) required`);
      for (const sql of rendered.up) this.logger.error(sql);
      process.exitCode = 1;
    } else {
      this.logger.info('Schema validation: OK (no drift)');
    }
  }
}
