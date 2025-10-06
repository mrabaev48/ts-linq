import type { DatabaseProvider } from '@ts-linq/core';
export interface BaseCommandInfo {
  readonly name: string;
  readonly describe: string;
  readonly aliases?: string[];
}
export interface Command extends BaseCommandInfo {
  run(argv: string[]): Promise<void>;
}
export interface DbCommand extends BaseCommandInfo {
  runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=Command.d.ts.map
