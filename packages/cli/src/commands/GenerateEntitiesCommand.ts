import type { DatabaseProvider } from '@ts-linq/core';
import * as path from 'path';

import { ConsoleLogger } from '../adapters/ConsoleLogger';
import { NodeFs } from '../adapters/NodeFs';
import { EntityTemplateBuilder } from '../generators/EntityTemplateBuilder';
import type { FileSystem } from '../ports/FileSystem';
import type { Logger } from '../ports/Logger';
import { inspectTable, listAllTables } from '../schema-inspect';
import { ArgReader } from '../services/ArgReader';
import { ensureDir, resolveDialect } from '../utils';
import type { DbCommand } from './Command';

export class GenerateEntitiesCommand implements DbCommand {
  public readonly name = 'generate:entities';
  public readonly describe = 'Generates entities for all tables of the schema';
  public readonly aliases = ['generate entities'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs(),
    private readonly template = new EntityTemplateBuilder()
  ) {}

  public async runDb(provider: DatabaseProvider, argv: string[]): Promise<void> {
    const args = new ArgReader(argv);
    const outDir = (args.flag('dir') as string) || path.join('src', 'entities');
    const schema = (args.flag('schema') as string) || undefined;
    const label = resolveDialect(provider.providerLabel);
    const destDir = path.resolve(process.cwd(), outDir);
    ensureDir(destDir);
    const tables = await listAllTables(provider, label, schema);
    if (tables.length === 0) {
      this.logger.info('No tables found to generate entities.');
      return;
    }
    for (const tbl of tables) {
      const cols = await inspectTable(provider, label, tbl, schema);
      const entityName = tbl
        .replace(/[^a-zA-Z0-9_]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join('');
      const destFile = path.join(destDir, `${entityName}.ts`);
      if (this.fsAdapter.exists(destFile)) continue;
      const tpl = this.template.buildFromColumns(entityName, tbl, cols);
      this.fsAdapter.writeText(destFile, tpl);
      this.logger.info(`Created entity ${entityName} for table '${tbl}' at ${destFile}`);
    }
  }
}
