import * as path from 'path';

import { ConsoleLogger } from '../adapters/ConsoleLogger';
import { NodeFs } from '../adapters/NodeFs';
import { tryLoadConfig } from '../config';
import type { FileSystem } from '../ports/FileSystem';
import type { Logger } from '../ports/Logger';
import type { Command } from './Command';

export class MigrationsValidateCommand implements Command {
  public readonly name = 'migration:validate';
  public readonly describe =
    'Validates migrations: name format, duplicates, order, presence of up/down';
  public readonly aliases = ['migrations:validate'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async run(_argv: string[]): Promise<void> {
    const migrationsDir = this.resolveMigrationsDir();
    if (!this.fsAdapter.exists(migrationsDir)) {
      this.logger.warn?.(`Migrations directory not found: ${migrationsDir}`);
      process.exitCode = 2;
      return Promise.resolve();
    }
    const files = this.readMigrationFiles(migrationsDir);
    const errors: string[] = [];
    const parsed = this.parseFilenames(files, errors);
    this.detectDuplicates(parsed, errors);
    this.checkOrder(parsed, errors);
    this.ensureTsSupport(parsed);
    this.validateExports(parsed, errors);
    this.report(errors);
    return Promise.resolve();
  }

  private resolveMigrationsDir(): string {
    const cfg = (tryLoadConfig(process.cwd()) || {}) as { migrations?: string };
    return path.resolve(process.cwd(), cfg.migrations || 'migrations');
  }

  private readMigrationFiles(dir: string): Array<{ file: string; abs: string }> {
    return this.fsAdapter
      .readDir(dir)
      .filter((f) => /(\.ts|\.js|\.mjs|\.cjs)$/.test(f))
      .map((f) => ({ file: f, abs: path.join(dir, f) }));
  }

  private parseFilenames(
    files: Array<{ file: string; abs: string }>,
    errors: string[]
  ): Array<{ file: string; abs: string; version: string; name: string }> {
    const versionRe = /^(\d{14})_([A-Za-z0-9_]+)\.(?:ts|js|mjs|cjs)$/;
    return files
      .map(({ file, abs }) => {
        const m = versionRe.exec(file);
        if (!m) {
          errors.push(`Invalid migration filename: ${file}`);
          return null;
        }
        return { file, abs, version: m[1], name: m[2] };
      })
      .filter((x): x is { file: string; abs: string; version: string; name: string } => !!x);
  }

  private detectDuplicates(parsed: Array<{ version: string }>, errors: string[]): void {
    const seen = new Set<string>();
    for (const p of parsed) {
      if (seen.has(p.version)) errors.push(`Duplicate version: ${p.version}`);
      seen.add(p.version);
    }
  }

  private checkOrder(parsed: Array<{ file: string; version: string }>, errors: string[]): void {
    const versionsSorted = [...parsed].sort((a, b) => a.version.localeCompare(b.version));
    const filesSorted = [...parsed].sort((a, b) => a.file.localeCompare(b.file));
    for (let i = 0; i < versionsSorted.length; i++) {
      if (versionsSorted[i].file !== filesSorted[i].file) {
        errors.push('Migrations are not ordered by version consistently with filenames');
        break;
      }
    }
  }

  private ensureTsSupport(parsed: Array<{ file: string }>): void {
    if (!parsed.some((p) => p.file.endsWith('.ts'))) return;
    try {
      require('ts-node/register/transpile-only');
    } catch {
      // ignore
    }
  }

  private validateExports(
    parsed: Array<{ file: string; abs: string; version: string }>,
    errors: string[]
  ): void {
    type MigrationLike = {
      up: () => Promise<void> | void;
      down: () => Promise<void> | void;
      getVersion: () => string;
      getName: () => string;
    };
    for (const p of parsed) {
      try {
        const mod = require(p.abs) as Record<string, unknown>;
        const keys = Object.keys(mod || {});
        if (keys.length === 0) {
          errors.push(`No exports found in ${p.file}`);
          continue;
        }
        const exported = mod[keys[0]];
        if (!exported || typeof exported !== 'function') {
          errors.push(`Invalid export in ${p.file}: expected class`);
          continue;
        }
        const Ctor = exported as unknown as { new (): MigrationLike };
        const inst: MigrationLike = new Ctor();
        if (typeof inst.up !== 'function' || typeof inst.down !== 'function') {
          errors.push(`Migration ${p.file} must implement up() and down()`);
        }
        if (typeof inst.getVersion !== 'function' || typeof inst.getName !== 'function') {
          errors.push(`Migration ${p.file} must implement getVersion() and getName()`);
        }
        if (typeof inst.getVersion === 'function') {
          const v = inst.getVersion();
          if (v !== p.version) errors.push(`Version mismatch in ${p.file}: ${v} != ${p.version}`);
        }
      } catch (e) {
        errors.push(`Failed to load ${p.file}: ${(e as Error).message}`);
      }
    }
  }

  private report(errors: string[]): void {
    if (errors.length > 0) {
      this.logger.error('Migration validation failed:');
      for (const e of errors) this.logger.error(`  - ${e}`);
      process.exitCode = 1;
      return;
    }
    this.logger.info('Migrations validation: OK');
    process.exitCode = 0;
  }
}
