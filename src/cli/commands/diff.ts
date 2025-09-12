import * as fs from 'fs';
import * as path from 'path';
import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import { makeEffectiveConfig } from '../runtime/config';
import { loadBootstrapFiles, loadEntitiesFromGlobs } from '../runtime/bootstrap';
import { DiffMigrationGenerator } from '../../migrations/DiffMigrationGenerator';
import { SQLiteProvider } from '../../providers/SQLiteProvider';
import { PostgresProvider } from '../../providers/PostgresProvider';
import { MySqlProvider } from '../../providers/MySqlProvider';
import { MssqlProvider } from '../../providers/MssqlProvider';
import { ConsoleLogger, NodeFsPort } from '../runtime/nodeAdapters';

function createProvider(id: 'sqlite' | 'postgresql' | 'mysql' | 'mssql', conn: string) {
  switch (id) {
    case 'sqlite':
      return new SQLiteProvider(conn);
    case 'postgresql':
      return new PostgresProvider(conn);
    case 'mysql':
      return new MySqlProvider(conn);
    case 'mssql':
      return new MssqlProvider(conn);
    default:
      return new SQLiteProvider(conn);
  }
}

export class DiffCommand implements Command {
  public async execute(_rest: string[], flags: Flags): Promise<number> {
    const fsp = new NodeFsPort();
    const logger = new ConsoleLogger();
    const effective = makeEffectiveConfig(flags);
    await loadBootstrapFiles(effective.bootstrap, flags.cwd || process.cwd());
    await loadEntitiesFromGlobs(effective.entitiesGlobs, flags.cwd || process.cwd());
    const provider = createProvider(effective.provider, effective.connectionString);
    await provider.connect();
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    await provider.disconnect();
    if (flags.create) {
      const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      const dir = effective.migrationsDir;
      if (!fsp.exists(dir)) fsp.mkdirp(dir);
      const file = path.join(dir, `${ts}_Diff.ts`);
      const bodyLines = steps.map((s, i) => `    // ${i + 1}) ${s.sql}`);
      const template = `import { Migration } from '../src/migrations/Migration';\n\nexport class Diff_${ts} extends Migration {\n  protected get name() { return 'Diff_${ts}'; }\n  protected get version() { return '${ts}'; }\n  public async up(): Promise<void> {\n${bodyLines.join('\n')}\n    // TODO: execute these statements using your provider\n  }\n  public async down(): Promise<void> {\n    // TODO: add rollback for the above changes if needed\n  }\n}\n`;
      fsp.writeText(file, template);
      if (flags.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ file, steps: steps.map((s) => s.sql) }, null, 2));
      } else if (!flags.quiet) {
        logger.log('info', `Created migration scaffold: ${file}`);
      }
      return 0;
    }
    if (flags.json) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ steps: steps.map((s) => s.sql) }, null, 2));
      return 0;
    }
    if (flags.out) {
      const outPath = path.resolve(flags.cwd || process.cwd(), flags.out);
      fsp.writeText(outPath, steps.map((s) => s.sql).join('\n') + '\n');
      if (!flags.quiet) logger.log('info', `Written ${steps.length} step(s) to ${outPath}`);
      return 0;
    }
    for (const step of steps) {
      // eslint-disable-next-line no-console
      console.log(step.sql);
    }
    return 0;
  }
}


