import * as path from 'path';
import { SchemaSnapshotBuilder, SchemaSnapshotSerializer } from '@ts-linq/core';
import type { DatabaseProvider } from '@ts-linq/core';
import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import { ConsoleLogger } from '../adapters/ConsoleLogger';
import type { FileSystem } from '../ports/FileSystem';
import { NodeFs } from '../adapters/NodeFs';

export class SchemaExportCommand implements Command {
  public readonly name = 'schema:export';
  public readonly describe = 'Экспортирует snapshot схемы из метаданных в файл';
  public readonly requiresProvider = false;
  public readonly aliases = ['schema export'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async run(_provider: DatabaseProvider | null, argv: string[]): Promise<void> {
    const out = argv[1] || path.resolve(process.cwd(), 'schema.snapshot.json');
    const snapshot = new SchemaSnapshotBuilder().buildExpectedFromMetadata();
    const json = new SchemaSnapshotSerializer().serialize(snapshot);
    this.fsAdapter.writeText(out, json);
    this.logger.info(`Schema snapshot saved to ${out}`);
  }
}
