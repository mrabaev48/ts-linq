import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class MigrationsDryRunCommand implements DbCommand {
  private readonly logger;
  private readonly fsAdapter;
  readonly name = 'migration:dry-run';
  readonly describe =
    '\u041F\u0435\u0447\u0430\u0442\u0430\u0435\u0442 SQL \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439 \u043C\u0435\u0436\u0434\u0443 snapshot \u0438 \u0411\u0414 (dry-run)';
  readonly aliases: string[];
  constructor(logger?: Logger, fsAdapter?: FileSystem);
  runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=MigrationsDryRunCommand.d.ts.map
