import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class SeedCommand implements DbCommand {
  private readonly logger;
  private readonly fsAdapter;
  readonly name = 'seed';
  readonly describe =
    '\u0412\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442 SQL \u0438\u0437 \u0444\u0430\u0439\u043B\u0430 \u0434\u043B\u044F \u043D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043D\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F';
  readonly aliases: string[];
  constructor(logger?: Logger, fsAdapter?: FileSystem);
  runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=SeedCommand.d.ts.map
