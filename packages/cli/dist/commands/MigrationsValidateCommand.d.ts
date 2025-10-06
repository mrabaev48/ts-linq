import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class MigrationsValidateCommand implements Command {
  private readonly logger;
  private readonly fsAdapter;
  readonly name = 'migration:validate';
  readonly describe =
    '\u0412\u0430\u043B\u0438\u0434\u0438\u0440\u0443\u0435\u0442 \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u0438: \u0444\u043E\u0440\u043C\u0430\u0442 \u0438\u043C\u0435\u043D, \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u044B, \u043F\u043E\u0440\u044F\u0434\u043E\u043A, \u043D\u0430\u043B\u0438\u0447\u0438\u0435 up/down';
  readonly aliases: string[];
  constructor(logger?: Logger, fsAdapter?: FileSystem);
  run(_argv: string[]): Promise<void>;
  private resolveMigrationsDir;
  private readMigrationFiles;
  private parseFilenames;
  private detectDuplicates;
  private checkOrder;
  private ensureTsSupport;
  private validateExports;
  private report;
}
//# sourceMappingURL=MigrationsValidateCommand.d.ts.map
