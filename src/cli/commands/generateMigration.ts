import * as path from 'path';
import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import { NodeFsPort, ConsoleLogger } from '../runtime/nodeAdapters';

export class GenerateMigrationCommand implements Command {
  public async execute(rest: string[], flags: Flags): Promise<number> {
    const rawName = rest[0] === 'migration' ? rest[1] : rest[0];
    const name = (rawName || 'Migration').replace(/\s+/g, '_');
    const ts = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const cwd = flags.cwd || process.cwd();
    const logger = new ConsoleLogger();
    const fsp = new NodeFsPort();
    const dir = path.resolve(cwd, 'migrations');
    fsp.mkdirp(dir);
    const file = path.join(dir, `${ts}_${name}.ts`);
    const template = `import { Migration } from '../src/migrations/Migration';

export class ${name} extends Migration {
  protected get name() { return '${name}'; }
  protected get version() { return '${ts}'; }

  public async up(): Promise<void> {
    // TODO: write your DDL here
  }

  public async down(): Promise<void> {
    // TODO: write your rollback here
  }
}
`;
    fsp.writeText(file, template);
    if (!flags.quiet) logger.log('info', `Created ${file}`);
    return 0;
  }
}
