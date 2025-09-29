import type { Command, DbCommand } from './commands/Command';

export class CommandRegistry {
  private readonly nameToCommand: Record<string, Command | DbCommand>;
  private readonly primary: Array<Command | DbCommand>;

  public constructor(commands: Array<Command | DbCommand>) {
    this.primary = commands;
    const map: Record<string, Command | DbCommand> = {};
    for (const c of commands) {
      map[c.name] = c;
      if (c.aliases) {
        for (const a of c.aliases) map[a] = c;
      }
    }
    this.nameToCommand = map;
  }

  public get(name: string | undefined): Command | DbCommand | undefined {
    if (!name) return undefined;
    return this.nameToCommand[name];
  }

  public listNames(): string[] {
    return Object.keys(this.nameToCommand);
  }

  public listCatalog(): Array<{ name: string; describe: string; aliases?: string[] }> {
    return this.primary.map((c) => ({ name: c.name, describe: c.describe, aliases: c.aliases }));
  }
}
