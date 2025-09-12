import type { Flags } from './types';

export interface Command {
  execute(rest: string[], flags: Flags): Promise<number> | number;
}


