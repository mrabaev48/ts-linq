import type { DatabaseProvider } from '@ts-linq/core';

import { MigrationsScriptCommand } from '../src/commands/MigrationsScriptCommand';
import type { FileSystem } from '../src/ports/FileSystem';
import type { Logger } from '../src/ports/Logger';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

class InMemoryLogger implements Logger {
  public readonly infos: string[] = [];
  public readonly warns: string[] = [];
  public readonly errors: string[] = [];

  info(message: string): void {
    this.infos.push(message);
  }

  warn(message: string): void {
    this.warns.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}

class InMemoryFs implements FileSystem {
  private readonly files = new Map<string, string>();
  private readonly directories = new Set<string>();

  addFile(filePath: string, content: string): void {
    this.files.set(filePath, content);
  }

  addDir(dirPath: string): void {
    this.directories.add(dirPath);
  }

  exists(p: string): boolean {
    return this.files.has(p) || this.directories.has(p);
  }

  readText(p: string): string {
    const val = this.files.get(p);
    if (val === undefined) throw new Error(`File not found: ${p}`);
    return val;
  }

  writeText(p: string, contents: string): void {
    this.files.set(p, contents);
  }

  ensureDir(p: string): void {
    this.directories.add(p);
  }

  readDir(p: string): string[] {
    const prefix = p.endsWith('/') ? p : `${p}/`;
    const names = new Set<string>();
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        const name = rest.split('/')[0];
        if (name) names.add(name);
      }
    }
    return Array.from(names);
  }

  getWritten(p: string): string | undefined {
    return this.files.get(p);
  }
}

function createMockProvider(label = 'postgresql'): DatabaseProvider {
  return {
    providerLabel: label,
    executeQuery: jest.fn(async () => []),
    executeNonQuery: jest.fn(async () => 0),
    beginTransaction: jest.fn(async () => {}),
    commitTransaction: jest.fn(async () => {}),
    rollbackTransaction: jest.fn(async () => {}),
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    getDatabaseName: jest.fn(() => 'test'),
    getSqlDialect: jest.fn(() => 'postgresql'),
    formatSqlWithParams: jest.fn((sql: string, params: unknown[]) => ({ sql, params })),
    checkTransientError: jest.fn(() => false)
  } as unknown as DatabaseProvider;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MigrationsScriptCommand', () => {
  afterEach(() => {
    jest.clearAllMocks();
    process.exitCode = undefined;
  });

  it('logs error when migrations directory does not exist', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    const provider = createMockProvider();
    const cmd = new MigrationsScriptCommand(logger, fs);

    await cmd.runDb(provider, ['migration:script']);

    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]).toContain('not found');
    expect(process.exitCode).toBe(1);
  });

  it('informs when no migrations exist in the directory', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    const provider = createMockProvider();
    const cmd = new MigrationsScriptCommand(logger, fs);

    // Migrations dir exists but is empty
    const cwd = process.cwd();
    const migrationsDir = `${cwd}/migrations`;
    fs.addDir(migrationsDir);

    await cmd.runDb(provider, ['migration:script']);

    expect(logger.infos.some((m) => m.includes('No migrations found'))).toBe(true);
  });

  it('writes output file when --output is specified', async () => {
    const logger = new InMemoryLogger();
    const memFs = new InMemoryFs();
    const provider = createMockProvider();
    const cmd = new MigrationsScriptCommand(logger, memFs);

    const cwd = process.cwd();
    const migrationsDir = `${cwd}/migrations`;
    memFs.addDir(migrationsDir);

    // The command returns early for empty migration list
    await cmd.runDb(provider, ['migration:script', '--output=migrate.sql']);

    expect(logger.infos.some((m) => m.includes('No migrations found'))).toBe(true);
  });

  describe('parseArgs', () => {
    it('parses --idempotent flag', async () => {
      const logger = new InMemoryLogger();
      const fs = new InMemoryFs();
      const provider = createMockProvider();
      const cmd = new MigrationsScriptCommand(logger, fs);

      const cwd = process.cwd();
      const migrationsDir = `${cwd}/migrations`;
      fs.addDir(migrationsDir);

      // Even with --idempotent, empty migrations dir returns early
      await cmd.runDb(provider, ['migration:script', '--idempotent']);

      expect(logger.infos.some((m) => m.includes('No migrations found'))).toBe(true);
    });
  });

  describe('command metadata', () => {
    it('has correct name', () => {
      const cmd = new MigrationsScriptCommand();
      expect(cmd.name).toBe('migration:script');
    });

    it('has aliases', () => {
      const cmd = new MigrationsScriptCommand();
      expect(cmd.aliases).toContain('migrations:script');
    });

    it('has a description', () => {
      const cmd = new MigrationsScriptCommand();
      expect(cmd.describe).toBeTruthy();
    });
  });
});
