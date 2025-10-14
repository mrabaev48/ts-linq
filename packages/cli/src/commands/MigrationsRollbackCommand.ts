import * as path from 'path';
import type { DatabaseProvider } from '@ts-linq/core';
import { MigrationRunner } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Migration } from '@ts-linq/core';
import type { Logger } from '../ports/Logger';
import { ConsoleLogger } from '../adapters/ConsoleLogger';
import type { FileSystem } from '../ports/FileSystem';
import { NodeFs } from '../adapters/NodeFs';
import { tryLoadConfig } from '../config';

export class MigrationsRollbackCommand implements DbCommand {
  public readonly name = 'migration:rollback';
  public readonly describe =
    'Rollback last migrations (--steps=N) or to a version (--to=YYYYMMDDHHmmss)';
  public readonly aliases = ['migrations:rollback'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async runDb(provider: DatabaseProvider, argv: string[]): Promise<void> {
    const { steps, toVersion } = this.parseArgs(argv);
    const migrationsDir = this.resolveMigrationsDir();
    const runner = new MigrationRunner(provider);
    const applied = await runner.getAppliedMigrations();

    const modules = await this.loadAllMigrations(migrationsDir);
    for (const mod of modules) this.registerModuleMigrations(mod, runner);

    const targetVersion = this.computeTargetVersion(applied, steps, toVersion);
    this.logRollbackTarget(steps, targetVersion);
    await runner.rollback(targetVersion);
    this.logger.info('Rollback completed');
  }

  private parseArgs(argv: string[]): { steps: number; toVersion?: string } {
    const stepsArg = argv.find((a) => a.startsWith('--steps='));
    const toArg = argv.find((a) => a.startsWith('--to='));
    const steps = stepsArg ? parseInt(stepsArg.split('=')[1] || '0', 10) : 0;
    const toVersion = toArg ? toArg.split('=')[1] : undefined;
    return { steps, toVersion };
  }

  private resolveMigrationsDir(): string {
    const cfg = (tryLoadConfig(process.cwd()) || {}) as { migrations?: string };
    return path.resolve(process.cwd(), cfg.migrations || 'migrations');
  }

  private loadAllMigrations(dir: string): Promise<Array<Record<string, unknown>>> {
    if (!this.fsAdapter.exists(dir)) return Promise.resolve([] as Array<Record<string, unknown>>);
    const files = this.fsAdapter
      .readDir(dir)
      .filter((f) => /\.(ts|js|mjs|cjs)$/.test(f))
      .map((f) => path.join(dir, f));

    if (files.some((f) => f.endsWith('.ts'))) this.tryRegisterTsNode();
    const mods: Array<Record<string, unknown>> = [];
    for (const file of files) mods.push(this.requireModule(file));
    return Promise.resolve(mods);
  }

  private tryRegisterTsNode(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('ts-node/register/transpile-only');
    } catch {
      // ignore if not available
    }
  }

  private requireModule(file: string): Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(file) as Record<string, unknown>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private registerModuleMigrations(mod: Record<string, any>, runner: MigrationRunner): void {
    for (const key of Object.keys(mod)) {
      const exported = mod[key];
      if (!exported || typeof exported !== 'function') continue;
      const proto = (exported as { prototype?: unknown }).prototype || {};
      const hasUp = Object.prototype.hasOwnProperty.call(proto, 'up');
      const hasDown = Object.prototype.hasOwnProperty.call(proto, 'down');
      if (!hasUp || !hasDown) continue;
      try {
        const Ctor = exported as unknown as { new (): { getVersion: () => string } };
        const instance = new Ctor();
        if (typeof instance.getVersion === 'function') {
          runner.addMigration(instance as unknown as Migration);
        }
      } catch {
        // ignore non-constructible exports
      }
    }
  }

  private computeTargetVersion(
    applied: Array<{ version: string }>,
    steps: number,
    toVersion?: string
  ): string | undefined {
    if (toVersion) return toVersion;
    if (steps <= 0) return undefined;
    const sorted = [...applied].sort((a, b) => a.version.localeCompare(b.version));
    const keepCount = Math.max(sorted.length - steps, 0);
    return keepCount > 0 ? sorted[keepCount - 1].version : undefined;
  }

  private logRollbackTarget(steps: number, targetVersion?: string): void {
    if (targetVersion) {
      this.logger.info(`Rolling back to version ${targetVersion}...`);
      return;
    }
    if (steps > 0) {
      this.logger.info(`Rolling back ${steps} step(s)...`);
      return;
    }
    this.logger.info('Rolling back all applied migrations...');
  }
}
