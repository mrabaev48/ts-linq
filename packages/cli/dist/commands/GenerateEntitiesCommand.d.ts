import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
import { EntityTemplateBuilder } from '../generators/EntityTemplateBuilder';
export declare class GenerateEntitiesCommand implements DbCommand {
  private readonly logger;
  private readonly fsAdapter;
  private readonly template;
  readonly name = 'generate:entities';
  readonly describe =
    '\u0413\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0435\u0442 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438 \u0434\u043B\u044F \u0432\u0441\u0435\u0445 \u0442\u0430\u0431\u043B\u0438\u0446 \u0441\u0445\u0435\u043C\u044B';
  readonly aliases: string[];
  constructor(logger?: Logger, fsAdapter?: FileSystem, template?: EntityTemplateBuilder);
  runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=GenerateEntitiesCommand.d.ts.map
