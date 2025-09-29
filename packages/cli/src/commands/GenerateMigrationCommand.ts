import * as path from 'path';
import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import { ConsoleLogger } from '../adapters/ConsoleLogger';
import type { FileSystem } from '../ports/FileSystem';
import { NodeFs } from '../adapters/NodeFs';
import { MigrationTemplateBuilder } from '../generators/MigrationTemplateBuilder';

export class GenerateMigrationCommand implements Command {
  public readonly name = 'generate:migration';
  public readonly describe = 'Создаёт файл миграции с шаблоном';
  public readonly aliases = ['generate migration'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs(),
    private readonly builder = new MigrationTemplateBuilder()
  ) {}

  public async run(argv: string[]): Promise<void> {
    const name = (argv[2] && argv[1] !== 'entity' ? argv[2] : argv[1] || 'Migration').replace(
      /\s+/g,
      '_'
    );
    const ts = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const dir = path.resolve(process.cwd(), 'migrations');
    this.fsAdapter.ensureDir(dir);
    const file = path.join(dir, `${ts}_${name}.ts`);
    const template = this.builder.build(name, ts);
    this.fsAdapter.writeText(file, template);
    this.logger.info(`Created ${file}`);
  }
}
