import * as path from 'node:path';

import type { BundleTarget } from '@ts-linq/migrations';
import { MigrationBundleBuilder } from '@ts-linq/migrations';

import { ConsoleLogger } from '../adapters/ConsoleLogger';
import { NodeFs } from '../adapters/NodeFs';
import { tryLoadConfig } from '../config';
import type { FileSystem } from '../ports/FileSystem';
import type { Logger } from '../ports/Logger';
import type { Command } from './Command';

/**
 * CLI command: `migrations bundle`
 *
 * Builds a self-contained Node.js migration bundle using esbuild.
 * The output file can be run with `node migrate.bundle.js` on the target
 * machine without requiring a full Node project or installed dependencies.
 *
 * Mirrors `dotnet ef migrations bundle --self-contained -r linux-x64`.
 *
 * @example
 * pnpm ts-linq migrations bundle --target node-linux-x64 --output dist/migrate.bundle.js
 * pnpm ts-linq migrations bundle   # defaults: current platform, ./dist/migrate.bundle.js
 */
export class MigrationsBundleCommand implements Command {
  public readonly name = 'migration:bundle';
  public readonly describe = 'Build a self-contained Node.js migration bundle (requires esbuild)';
  public readonly aliases = ['migrations:bundle'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async run(argv: string[]): Promise<void> {
    const { target, outputFile } = this.parseArgs(argv);
    const migrationsDir = this.resolveMigrationsDir();

    if (!this.fsAdapter.exists(migrationsDir)) {
      this.logger.error(`Migrations directory not found: ${migrationsDir}`);
      this.logger.error('Generate a migration first with: pnpm ts-linq generate:migration <Name>');
      process.exitCode = 1;
      return;
    }

    const resolvedOutput = path.resolve(process.cwd(), outputFile);

    this.logger.info(`Building migration bundle...`);
    this.logger.info(`  Migrations: ${migrationsDir}`);
    this.logger.info(`  Target:     ${target ?? 'current platform (auto-detected)'}`);
    this.logger.info(`  Output:     ${resolvedOutput}`);

    const builder = new MigrationBundleBuilder();

    try {
      await builder.build({
        migrationsDir,
        outputFile: resolvedOutput,
        target: target as BundleTarget | undefined
      });
      this.logger.info(`Bundle created successfully: ${resolvedOutput}`);
      this.logger.info('Run with: node ' + path.basename(resolvedOutput));
    } catch (err) {
      this.logger.error(`Bundle build failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private parseArgs(argv: string[]): { target?: string; outputFile: string } {
    const targetArg = argv.find((a) => a.startsWith('--target=') || a === '--target');
    let target: string | undefined;

    if (targetArg) {
      if (targetArg.includes('=')) {
        target = targetArg.split('=').slice(1).join('=');
      } else {
        const idx = argv.indexOf('--target');
        target = argv[idx + 1];
      }
    }

    const outputArg = argv.find((a) => a.startsWith('--output=') || a === '--output');
    let outputFile = path.join('dist', 'migrate.bundle.js');

    if (outputArg) {
      if (outputArg.includes('=')) {
        outputFile = outputArg.split('=').slice(1).join('=');
      } else {
        const idx = argv.indexOf('--output');
        outputFile = argv[idx + 1] ?? outputFile;
      }
    }

    return { target, outputFile };
  }

  private resolveMigrationsDir(): string {
    const cfg = (tryLoadConfig(process.cwd()) ?? {}) as { migrations?: string };
    return path.resolve(process.cwd(), cfg.migrations ?? 'migrations');
  }
}
