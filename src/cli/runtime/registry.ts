import type { Command } from './command';

export class CommandRegistry {
  private commands: Record<string, Command> = {};

  public register(name: string, command: Command): void {
    this.commands[name] = command;
  }

  public get(name: string): Command | undefined {
    return this.commands[name];
  }
}


