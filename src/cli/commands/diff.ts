import * as fs from 'fs';
import * as path from 'path';
import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import { makeEffectiveConfig } from '../runtime/config';
import { loadBootstrapFiles, loadEntitiesFromGlobs } from '../runtime/bootstrap';
import { DiffMigrationGenerator } from '../../migrations/DiffMigrationGenerator';
import type { SchemaSnapshot, SchemaDiff } from '../../migrations/DiffTypes';
import { compareSchemas } from '../../migrations/DiffTypes';
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
    let detailsObj:
      | { expected?: SchemaSnapshot; actual?: SchemaSnapshot; diff?: SchemaDiff }
      | undefined;
    if (flags.details) {
      // Recreate snapshots via same logic by temporarily instantiating inspectors again
      // For simplicity, reuse provider and MetadataStorage within generator through a helper method in future.
      // Here, we just re-import compare by running a fresh generator pass that exposes snapshots via private access replacement in future.
      // Minimal approach: run lightweight inspectors and metadata here is non-trivial; fallback to steps-only if fails.
      try {
        const { expected, actual } = await gen.buildSnapshots();
        const diff = compareSchemas(expected, actual);
        detailsObj = { expected, actual, diff };
      } catch {
        detailsObj = undefined;
      }
    }
    await provider.disconnect();
    if (flags.create) {
      const ts = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14);
      const providedName =
        flags.name && flags.name.trim() ? flags.name.trim().replace(/\s+/g, '_') : undefined;
      const dir = effective.migrationsDir;
      if (!fsp.exists(dir)) fsp.mkdirp(dir);
      const file = providedName
        ? path.join(dir, `${ts}_${providedName}.ts`)
        : path.join(dir, `${ts}_Diff.ts`);
      const className = providedName ?? `Diff_${ts}`;
      const displayName = providedName ?? `Diff_${ts}`;
      const bodyLines = steps.map((s, i) => `    // ${i + 1}) ${s.sql}`);
      const template = `import { Migration } from '../src/migrations/Migration';\n\nexport class ${className} extends Migration {\n  protected get name() { return '${displayName}'; }\n  protected get version() { return '${ts}'; }\n  public async up(): Promise<void> {\n${bodyLines.join('\n')}\n    // TODO: execute these statements using your provider\n  }\n  public async down(): Promise<void> {\n    // TODO: add rollback for the above changes if needed\n  }\n}\n`;
      fsp.writeText(file, template);
      if (flags.json) {
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            {
              file,
              steps: steps.map((s) => s.sql),
              ...(flags.details && detailsObj ? { details: detailsObj } : {})
            },
            null,
            2
          )
        );
      } else if (!flags.quiet) {
        logger.log('info', `Created migration scaffold: ${file}`);
      }
      return 0;
    }
    if (flags.json) {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            steps: steps.map((s) => s.sql),
            ...(flags.details && detailsObj ? { details: detailsObj } : {})
          },
          null,
          2
        )
      );
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
