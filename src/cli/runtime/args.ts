import type { Flags, ProviderId } from './types';

export function parseArgs(argv: string[]): { cmd?: string; rest: string[]; flags: Flags } {
  const rest: string[] = [];
  const flags: Flags = {};
  let cmd: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.replace(/^--/, '').split('=');
      switch (k) {
        case 'provider':
          flags.provider = v as ProviderId;
          break;
        case 'conn':
          flags.conn = v;
          break;
        case 'json':
          flags.json = true;
          break;
        case 'details':
          flags.details = true;
          break;
        case 'dry-run':
          flags.dryRun = true;
          break;
        case 'cwd':
          flags.cwd = v;
          break;
        case 'to':
          flags.toVersion = v;
          break;
        case 'step':
          flags.step = Number(v);
          break;
        case 'verbose':
          flags.verbose = true;
          break;
        case 'quiet':
          flags.quiet = true;
          break;
        case 'yes':
          flags.yes = true;
          break;
        case 'out':
          flags.out = v;
          break;
        case 'create':
          flags.create = true;
          break;
        case 'name':
          flags.name = v;
          break;
        case 'db':
          flags.db = true;
          break;
        case 'dir':
          flags.dir = v;
          break;
        case 'pk':
          flags.pk = v;
          break;
        case 'columns':
          flags.columns = v;
          break;
        case 'file':
          flags.file = v;
          break;
        case 'help':
          cmd = 'help';
          break;
        case 'version':
          cmd = 'version';
          break;
        default:
          break;
      }
    } else if (arg.startsWith('-')) {
      if (arg.includes('h')) cmd = 'help';
      if (arg.includes('v')) cmd = cmd ?? 'version';
    } else if (!cmd) {
      cmd = arg;
    } else {
      rest.push(arg);
    }
  }
  return { cmd, rest, flags };
}
