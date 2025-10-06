import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class SchemaDiffCommand implements DbCommand {
  private readonly logger;
  private readonly fsAdapter;
  readonly name = 'schema:diff';
  readonly describe =
    '\u041F\u0435\u0447\u0430\u0442\u0430\u0435\u0442 SQL \u043E\u0442\u043B\u0438\u0447\u0438\u0439 \u043C\u0435\u0436\u0434\u0443 snapshot \u0438 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u0441\u0445\u0435\u043C\u043E\u0439';
  readonly aliases: string[];
  constructor(logger?: Logger, fsAdapter?: FileSystem);
  runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=SchemaDiffCommand.d.ts.map
