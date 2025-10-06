import type { Command, DbCommand } from './commands/Command';
export declare class CommandRegistry {
  private readonly nameToCommand;
  private readonly primary;
  constructor(commands: Array<Command | DbCommand>);
  get(name: string | undefined): Command | DbCommand | undefined;
  listNames(): string[];
  listCatalog(): Array<{
    name: string;
    describe: string;
    aliases?: string[];
  }>;
}
//# sourceMappingURL=CommandRegistry.d.ts.map
