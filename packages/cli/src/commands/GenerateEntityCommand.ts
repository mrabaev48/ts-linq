import * as path from 'path';
import type { DatabaseProvider } from '@ts-linq/core';
import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import { ConsoleLogger } from '../adapters/ConsoleLogger';
import type { FileSystem } from '../ports/FileSystem';
import { NodeFs } from '../adapters/NodeFs';
import { ensureDir, resolveDialect } from '../utils';
import { inspectTable } from '../schema-inspect';
import { EntityTemplateBuilder } from '../generators/EntityTemplateBuilder';
import { ArgReader } from '../services/ArgReader';

export class GenerateEntityCommand implements Command {
  public readonly name = 'generate:entity';
  public readonly describe = 'Генерирует сущность из имени или из таблицы';
  public readonly requiresProvider = true;
  public readonly aliases = ['generate entity'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs(),
    private readonly template = new EntityTemplateBuilder()
  ) {}

  public async run(provider: DatabaseProvider | null, argv: string[]): Promise<void> {
    if (!provider) throw new Error('Provider is required');
    const args = new ArgReader(argv);
    const rawName = (argv[2] || '').trim();
    if (!rawName) {
      this.logger.error(
        'Usage: ts-linq generate entity <Name> [--table users] [--dir src/entities]'
      );
      process.exitCode = 2;
      return;
    }
    const toPascal = (s: string): string =>
      s
        .replace(/[-_\s]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
        .join('');

    const entityName = toPascal(rawName);
    const outDir = (args.flag('dir') as string) || path.join('src', 'entities');
    const table = (args.flag('table') as string) || `${entityName.toLowerCase()}s`;
    const fromTable = (args.flag('from-table') as string) || undefined;
    const schema = (args.flag('schema') as string) || undefined;
    const destDir = path.resolve(process.cwd(), outDir);
    ensureDir(destDir);
    const destFile = path.join(destDir, `${entityName}.ts`);

    let tpl: string;
    if (fromTable) {
      const label = resolveDialect(provider.providerLabel);
      const defs = await inspectTable(provider, label, fromTable, schema);
      tpl = this.template.buildFromColumns(entityName, fromTable, defs);
    } else {
      tpl = this.template.buildDefault(entityName, table);
    }

    if (this.fsAdapter.exists(destFile)) {
      this.logger.error(`Entity already exists: ${destFile}`);
      process.exitCode = 2;
      return;
    }
    this.fsAdapter.writeText(destFile, tpl);
    this.logger.info(`Created entity ${entityName} at ${destFile}`);
  }
}
