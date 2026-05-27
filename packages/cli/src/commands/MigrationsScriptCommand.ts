import * as path from 'node:path';

import type { DatabaseProvider } from '@ts-linq/core';
import type { Dialect, IdempotentMigrationStep } from '@ts-linq/migrations';
import { IdempotentEmitter, MigrationRunner } from '@ts-linq/migrations';

import { ConsoleLogger } from '../adapters/ConsoleLogger';
import { NodeFs } from '../adapters/NodeFs';
import { tryLoadConfig } from '../config';
import type { FileSystem } from '../ports/FileSystem';
import type { Logger } from '../ports/Logger';
import type { DbCommand } from './Command';

/**
 * CLI command: `migrations script`
 *
 * Generates a SQL script from migration files. With `--idempotent`, each
 * migration step is wrapped in a guard block that checks `__migrations` before
 * executing, making the script safe to re-run.
 *
 * Mirrors `dotnet ef migrations script --idempotent --output migrate.sql`.
 *
 * @example
 * pnpm ts-linq migrations script --idempotent --output migrate.sql
 * pnpm ts-linq migrations script --output migrate.sql
 * pnpm ts-linq migrations script --idempotent   # prints to stdout
 */
export class MigrationsScriptCommand implements DbCommand {
  public readonly name = 'migration:script';
  public readonly describe =
    'Generate a SQL script from migration files (use --idempotent for re-runnable output)';
  public readonly aliases = ['migrations:script'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async runDb(provider: DatabaseProvider, argv: string[]): Promise<void> {
    const { isIdempotent, outputFile } = this.parseArgs(argv);
    const migrationsDir = this.resolveMigrationsDir();
    const dialect = this.detectDialect(provider);

    if (!this.fsAdapter.exists(migrationsDir)) {
      this.logger.error(`Migrations directory not found: ${migrationsDir}`);
      process.exitCode = 1;
      return;
    }

    const steps = await this.collectMigrationSteps(provider, migrationsDir);

    if (steps.length === 0) {
      this.logger.info('No migrations found — nothing to script.');
      return;
    }

    const emitter = new IdempotentEmitter();
    const sql = isIdempotent ? emitter.emit(steps, dialect) : this.buildPlainScript(steps, dialect);

    if (outputFile) {
      const resolved = path.resolve(process.cwd(), outputFile);
      this.fsAdapter.ensureDir(path.dirname(resolved));
      this.fsAdapter.writeText(resolved, sql);
      this.logger.info(`SQL script written to: ${resolved}`);
    } else {
      process.stdout.write(sql + '\n');
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private parseArgs(argv: string[]): { isIdempotent: boolean; outputFile?: string } {
    const isIdempotent = argv.includes('--idempotent');
    const outputArg = argv.find((a) => a.startsWith('--output=') || a === '--output');
    let outputFile: string | undefined;

    if (outputArg) {
      if (outputArg.includes('=')) {
        outputFile = outputArg.split('=').slice(1).join('=');
      } else {
        const idx = argv.indexOf('--output');
        outputFile = argv[idx + 1];
      }
    }

    return { isIdempotent, outputFile };
  }

  private resolveMigrationsDir(): string {
    const cfg = (tryLoadConfig(process.cwd()) ?? {}) as { migrations?: string };
    return path.resolve(process.cwd(), cfg.migrations ?? 'migrations');
  }

  private detectDialect(provider: DatabaseProvider): Dialect {
    const label = (provider.providerLabel as string | undefined) ?? '';
    if (label === 'mysql') return 'mysql';
    if (label === 'mssql') return 'mssql';
    return 'postgresql';
  }

  private async collectMigrationSteps(
    provider: DatabaseProvider,
    migrationsDir: string
  ): Promise<IdempotentMigrationStep[]> {
    const files = this.fsAdapter
      .readDir(migrationsDir)
      .filter((f) => /^(\d{14})_[A-Za-z0-9_]+\.(ts|js|mjs|cjs)$/.test(f))
      .sort();

    if (files.length === 0) return [];

    const steps: IdempotentMigrationStep[] = [];

    // Register ts-node if needed for .ts files
    if (files.some((f) => f.endsWith('.ts'))) {
      this.tryRegisterTsNode();
    }

    for (const file of files) {
      const match = /^(\d{14})_([A-Za-z0-9_]+)\.(ts|js|mjs|cjs)$/.exec(file);
      if (!match) continue;

      const version = match[1];
      const name = match[2];

      // Always collect UP SQL — needed both for plain scripts and idempotent scripts.
      const upSql = await this.extractUpSql(path.join(migrationsDir, file), provider);

      steps.push({ version, name, upSql });
    }

    const runner = new MigrationRunner(provider);
    const applied = await runner.getAppliedMigrations();
    const appliedVersions = new Set(applied.map((m) => m.version));

    return steps.filter((s) => !appliedVersions.has(s.version));
  }

  private async extractUpSql(filePath: string, provider: DatabaseProvider): Promise<string[]> {
    const collected: string[] = [];

    let mod: Record<string, unknown>;
    try {
      mod = require(filePath) as Record<string, unknown>;
    } catch {
      return [];
    }

    for (const key of Object.keys(mod)) {
      const Ctor = mod[key];
      if (typeof Ctor !== 'function') continue;
      const proto = (Ctor as { prototype?: unknown }).prototype ?? {};
      if (!('up' in (proto as object)) || !('down' in (proto as object))) continue;

      try {
        const spyProvider = this.createSpyProvider(provider, collected);
        const instance = new (Ctor as new (p: DatabaseProvider) => {
          up(): Promise<void>;
          getVersion(): string;
        })(spyProvider);

        if (typeof instance.getVersion !== 'function') continue;

        await instance.up();
        break;
      } catch {
        continue;
      }
    }

    return collected;
  }

  private createSpyProvider(real: DatabaseProvider, collector: string[]): DatabaseProvider {
    return new Proxy(real, {
      get(target, prop) {
        if (prop === 'executeNonQuery') {
          return async (sql: string): Promise<number> => {
            collector.push(sql);
            return Promise.resolve(0);
          };
        }
        return Reflect.get(target as object, prop) as unknown;
      }
    });
  }

  private buildPlainScript(steps: IdempotentMigrationStep[], _dialect: Dialect): string {
    const lines: string[] = [
      '-- Migration script',
      '-- Generated by @ts-linq/migrations',
      `-- Generated at: ${new Date().toISOString()}`,
      ''
    ];

    for (const step of steps) {
      lines.push(`-- Migration: ${step.version}_${step.name}`);
      for (const sql of step.upSql) {
        lines.push(sql.trim(), '');
      }
    }

    return lines.join('\n');
  }

  private tryRegisterTsNode(): void {
    try {
      require('ts-node/register/transpile-only');
    } catch {
      // ts-node not available — skip
    }
  }
}
