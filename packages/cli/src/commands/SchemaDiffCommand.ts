import type { DatabaseProvider } from '@ts-linq/core';
import {
  compareSchemas,
  generateMigrationFromDiff,
  SchemaSnapshotBuilder,
  SchemaSnapshotSerializer
} from '@ts-linq/migrations';
import * as path from 'path';

import { ConsoleLogger } from '../adapters/ConsoleLogger';
import { NodeFs } from '../adapters/NodeFs';
import type { FileSystem } from '../ports/FileSystem';
import type { Logger } from '../ports/Logger';
import { resolveDialect } from '../utils';
import type { DbCommand } from './Command';

export class SchemaDiffCommand implements DbCommand {
  public readonly name = 'schema:diff';
  public readonly describe = 'Prints SQL differences between snapshot and actual schema';
  public readonly aliases = ['schema diff'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async runDb(provider: DatabaseProvider, argv: string[]): Promise<void> {
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
    for (const sql of rendered.up) this.logger.info(sql);
  }
}
