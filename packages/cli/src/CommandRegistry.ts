import type { Command } from './commands/Command';

export class CommandRegistry {
  private readonly nameToCommand: Record<string, Command>;
  private readonly primary: Command[];

  public constructor(commands: Command[]) {
    this.primary = commands;
    const map: Record<string, Command> = {};
    for (const c of commands) {
      map[c.name] = c;
      if (c.aliases) {
        for (const a of c.aliases) map[a] = c;
      }
    }
    this.nameToCommand = map;
  }

  public get(name: string | undefined): Command | undefined {
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
