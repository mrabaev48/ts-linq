import * as path from 'path';
import type { DatabaseProvider } from '@ts-linq/core';
import { MigrationRunner } from '@ts-linq/core';
import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import { ConsoleLogger } from '../adapters/ConsoleLogger';
import type { FileSystem } from '../ports/FileSystem';
import { NodeFs } from '../adapters/NodeFs';
import { tryLoadConfig } from '../config';

export class MigrationsRollbackCommand implements Command {
  public readonly name = 'migration:rollback';
  public readonly describe =
    'Откатить последние миграции (--steps=N) или до версии (--to=YYYYMMDDHHmmss)';
  public readonly requiresProvider = true;
  public readonly aliases = ['migrations:rollback'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async run(provider: DatabaseProvider | null, argv: string[]): Promise<void> {
    if (!provider) throw new Error('Provider is required');

    // parse args: --steps=N or --to=version
    const stepsArg = argv.find((a) => a.startsWith('--steps='));
    const toArg = argv.find((a) => a.startsWith('--to='));
    const steps = stepsArg ? parseInt(stepsArg.split('=')[1] || '0', 10) : 0;
    const toVersion = toArg ? toArg.split('=')[1] : undefined;

    const cfg = (tryLoadConfig(process.cwd()) || {}) as { migrations?: string };
    const migrationsDir = path.resolve(process.cwd(), cfg.migrations || 'migrations');

    const loadAllMigrations = async () => {
      if (!this.fsAdapter.exists(migrationsDir)) return [] as unknown[];
      const files = this.fsAdapter
        .readDir(migrationsDir)
        .filter((f) => /\.(ts|js|mjs|cjs)$/.test(f))
        .map((f) => path.join(migrationsDir, f));

      // register ts-node for .ts files at runtime if available
      if (files.some((f) => f.endsWith('.ts'))) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('ts-node/register/transpile-only');
        } catch {
          // ignore if not available
        }
      }

      const mods: Array<Record<string, unknown>> = [];
      for (const file of files) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(file);
        mods.push(mod);
      }
      return mods;
    };

    const runner = new MigrationRunner(provider);
    const applied = await runner.getAppliedMigrations();

    // load migration classes from files and register in runner
    const modules = (await loadAllMigrations()) as Array<Record<string, unknown>>;
    for (const mod of modules) {
      for (const key of Object.keys(mod as object)) {
        const exported = mod[key];
        if (
          exported &&
          typeof exported === 'function' &&
          Object.prototype.hasOwnProperty.call(
            (exported as unknown as { prototype: unknown }).prototype || {},
            'up'
          ) &&
          Object.prototype.hasOwnProperty.call(
            (exported as unknown as { prototype: unknown }).prototype || {},
            'down'
          )
        ) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            const Ctor = exported as unknown as { new (): { getVersion: () => string } };
            const instance = new Ctor();
            if (typeof instance.getVersion === 'function') {
              runner.addMigration(instance as unknown as import('@ts-linq/core').Migration);
            }
          } catch {
            // ignore non-constructible exports
          }
        }
      }
    }

    let targetVersion: string | undefined = toVersion;
    if (!targetVersion && steps > 0) {
      const sortedApplied = [...applied].sort((a, b) => a.version.localeCompare(b.version));
      const keepCount = Math.max(sortedApplied.length - steps, 0);
      targetVersion = keepCount > 0 ? sortedApplied[keepCount - 1].version : undefined;
    }

    this.logger.info(
      targetVersion
        ? `Rolling back to version ${targetVersion}...`
        : steps > 0
          ? `Rolling back ${steps} step(s)...`
          : 'Rolling back all applied migrations...'
    );

    await runner.rollback(targetVersion);
    this.logger.info('Rollback completed');
  }
}
