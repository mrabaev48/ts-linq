import * as path from 'path';
import type { DatabaseProvider } from '@ts-linq/core';
import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import { ConsoleLogger } from '../adapters/ConsoleLogger';
import type { FileSystem } from '../ports/FileSystem';
import { NodeFs } from '../adapters/NodeFs';
import { tryLoadConfig } from '../config';

export class MigrationsValidateCommand implements Command {
  public readonly name = 'migration:validate';
  public readonly describe =
    'Валидирует миграции: формат имен, дубликаты, порядок, наличие up/down';
  public readonly requiresProvider = false;
  public readonly aliases = ['migrations:validate'];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs()
  ) {}

  public async run(_provider: DatabaseProvider | null, _argv: string[]): Promise<void> {
    const cfg = (tryLoadConfig(process.cwd()) || {}) as { migrations?: string };
    const migrationsDir = path.resolve(process.cwd(), cfg.migrations || 'migrations');

    if (!this.fsAdapter.exists(migrationsDir)) {
      this.logger.warn?.(`Migrations directory not found: ${migrationsDir}`);
      process.exitCode = 2;
      return;
    }

    const files = this.fsAdapter
      .readDir(migrationsDir)
      .filter((f) => /(\.ts|\.js|\.mjs|\.cjs)$/.test(f))
      .map((f) => ({ file: f, abs: path.join(migrationsDir, f) }));

    const versionRe = /^(\d{14})_([A-Za-z0-9_]+)\.(?:ts|js|mjs|cjs)$/;
    const errors: string[] = [];

    // 1) Имя и версия
    const parsed = files
      .map(({ file, abs }) => {
        const m = versionRe.exec(file);
        if (!m) {
          errors.push(`Invalid migration filename: ${file}`);
          return null;
        }
        return { file, abs, version: m[1], name: m[2] };
      })
      .filter((x): x is { file: string; abs: string; version: string; name: string } => !!x);

    // 2) Дубликаты версий
    const seen = new Set<string>();
    for (const p of parsed) {
      if (seen.has(p.version)) errors.push(`Duplicate version: ${p.version}`);
      seen.add(p.version);
    }

    // 3) Порядок по версии должен совпадать с сортировкой файлов по имени
    const versionsSorted = [...parsed].sort((a, b) => a.version.localeCompare(b.version));
    const filesSorted = [...parsed].sort((a, b) => a.file.localeCompare(b.file));
    for (let i = 0; i < versionsSorted.length; i++) {
      if (versionsSorted[i].file !== filesSorted[i].file) {
        errors.push('Migrations are not ordered by version consistently with filenames');
        break;
      }
    }

    // 4) Экспорты: класс с up/down и getVersion/getName
    const needsTs = parsed.some((p) => p.file.endsWith('.ts'));
    if (needsTs) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('ts-node/register/transpile-only');
      } catch {
        // игнорируем, если нет в окружении
      }
    }

    type MigrationLike = {
      up: () => Promise<void> | void;
      down: () => Promise<void> | void;
      getVersion: () => string;
      getName: () => string;
    };

    for (const p of parsed) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
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

    if (errors.length > 0) {
      this.logger.error('Migration validation failed:');
      for (const e of errors) this.logger.error(`  - ${e}`);
      process.exitCode = 1;
      return;
    }

    this.logger.info('Migrations validation: OK');
  }
}
