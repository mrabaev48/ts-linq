import * as path from 'path';
import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import { ConsoleLogger } from '../adapters/ConsoleLogger';
import type { FileSystem } from '../ports/FileSystem';
import { NodeFs } from '../adapters/NodeFs';
import { ensureDir, resolveDialect } from '../utils';
import { inspectTable, listAllTables } from '../schema-inspect';
import { EntityTemplateBuilder } from '../generators/EntityTemplateBuilder';
import { ArgReader } from '../services/ArgReader';

export class GenerateEntitiesCommand implements DbCommand {
  public readonly name = 'generate:entities';
  public readonly describe = 'Генерирует сущности для всех таблиц схемы';
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
      // eslint-disable-next-line no-await-in-loop
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
