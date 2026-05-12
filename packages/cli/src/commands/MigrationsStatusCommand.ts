import * as path from 'path';
import type { DatabaseProvider } from '@ts-linq/core';
import { MigrationRunner } from '@ts-linq/migrations';
import { tryLoadConfig } from '../config';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import { ConsoleLogger } from '../adapters/ConsoleLogger';
import type { FileSystem } from '../ports/FileSystem';
import { NodeFs } from '../adapters/NodeFs';

export class MigrationsStatusCommand implements DbCommand {
  public readonly name = 'migration:status';
  public readonly describe = 'Shows status of applied/pending migrations';
  public readonly aliases = ['migrations:status'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async runDb(provider: DatabaseProvider, _argv: string[]): Promise<void> {
    const cfg = (tryLoadConfig(process.cwd()) || {}) as { migrations?: string };
    const migrationsDir = path.resolve(process.cwd(), cfg.migrations || 'migrations');

    const listLocal = (): Array<{ version: string; name: string; file: string }> => {
      if (!this.fsAdapter.exists(migrationsDir)) return [];
      const files = this.fsAdapter.readDir(migrationsDir);
      const res: Array<{ version: string; name: string; file: string }> = [];
      for (const f of files) {
        const m = /^(\d{14})_(.+)\.(?:ts|js|cjs|mjs)$/.exec(f);
        if (m) res.push({ version: m[1], name: m[2], file: path.join(migrationsDir, f) });
      }
      res.sort((a, b) => a.version.localeCompare(b.version));
      return res;
    };

    const runner = new MigrationRunner(provider);
    const applied = await runner.getAppliedMigrations();
    const local = listLocal();
    const appliedSet = new Set(applied.map((a) => a.version));
    const pending = local.filter((l) => !appliedSet.has(l.version));

    this.logger.info(`Migrations directory: ${migrationsDir}`);
    this.logger.info(`Applied: ${applied.length}`);
    for (const a of applied) this.logger.info(`  ${a.version}  ${a.name}`);
    this.logger.info(`Pending: ${pending.length}`);
    for (const p of pending) this.logger.info(`  ${p.version}  ${p.name}`);
  }
}
