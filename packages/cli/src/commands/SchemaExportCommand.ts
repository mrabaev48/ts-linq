import { SchemaSnapshotBuilder, SchemaSnapshotSerializer } from '@ts-linq/migrations';
import * as path from 'path';

import { ConsoleLogger } from '../adapters/ConsoleLogger';
import { NodeFs } from '../adapters/NodeFs';
import type { FileSystem } from '../ports/FileSystem';
import type { Logger } from '../ports/Logger';
import type { Command } from './Command';

export class SchemaExportCommand implements Command {
  public readonly name = 'schema:export';
  public readonly describe = 'Exports schema snapshot from metadata to a file';
  public readonly aliases = ['schema export'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async run(argv: string[]): Promise<void> {
    const out = argv[1] || path.resolve(process.cwd(), 'schema.snapshot.json');
    const snapshot = new SchemaSnapshotBuilder().buildExpectedFromMetadata();
    const json = new SchemaSnapshotSerializer().serialize(snapshot);
    this.fsAdapter.writeText(out, json);
    this.logger.info(`Schema snapshot saved to ${out}`);
    return Promise.resolve();
  }
}
