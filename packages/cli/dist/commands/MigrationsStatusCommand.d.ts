import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class MigrationsStatusCommand implements DbCommand {
  private readonly logger;
  private readonly fsAdapter;
  readonly name = 'migration:status';
  readonly describe =
    '\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u0440\u0438\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0445/\u043E\u0436\u0438\u0434\u0430\u044E\u0449\u0438\u0445 \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u0439';
  readonly aliases: string[];
  constructor(logger?: Logger, fsAdapter?: FileSystem);
  runDb(provider: DatabaseProvider, _argv: string[]): Promise<void>;
}
//# sourceMappingURL=MigrationsStatusCommand.d.ts.map
