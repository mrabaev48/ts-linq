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
import { getFlag, resolveDialect } from '../utils';
import type { DbCommand } from './Command';

export class SchemaApplyCommand implements DbCommand {
  public readonly name = 'schema:apply';
  public readonly describe = 'Applies snapshot differences to the database';
  public readonly aliases = ['schema apply'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async runDb(provider: DatabaseProvider, argv: string[]): Promise<void> {
    const file = argv[0] || path.resolve(process.cwd(), 'schema.snapshot.json');
    const dryRun = !!getFlag(argv, 'dry-run');
    const force = !!getFlag(argv, 'force');
    if (!this.fsAdapter.exists(file)) {
      this.logger.error(`Snapshot file not found: ${file}`);
      process.exitCode = 2;
      return;
    }
    const target = new SchemaSnapshotSerializer().deserialize(this.fsAdapter.readText(file));
    const actual = await new SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
    const diff = compareSchemas(target, actual);
    const rendered = generateMigrationFromDiff(diff, resolveDialect(provider.providerLabel));
    let applied = 0;
    for (const sql of rendered.up) {
      if (sql.trim().startsWith('--')) continue;
      const destructive = /\b(DROP|DELETE)\b/i.test(sql);
      if (dryRun) {
        this.logger.info(sql);
        continue;
      }
      if (destructive && !force) {
        this.logger.warn(
          'Destructive change detected (DROP/DELETE). Re-run with --force to apply.'
        );
        process.exitCode = 2;
        return;
      }

      await provider.executeNonQuery(sql);
      applied++;
    }
    if (!dryRun) this.logger.info(`Applied ${applied} step(s) from snapshot`);
  }
}
