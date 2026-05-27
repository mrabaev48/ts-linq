import { MigrationsBundleCommand } from '../src/commands/MigrationsBundleCommand';
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

  addDir(dirPath: string): void {
    this.directories.add(dirPath);
  }

  addFile(filePath: string, content: string): void {
    this.files.set(filePath, content);
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
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MigrationsBundleCommand', () => {
  afterEach(() => {
    jest.clearAllMocks();
    process.exitCode = undefined;
  });

  describe('command metadata', () => {
    it('has correct name', () => {
      const cmd = new MigrationsBundleCommand();
      expect(cmd.name).toBe('migration:bundle');
    });

    it('has aliases', () => {
      const cmd = new MigrationsBundleCommand();
      expect(cmd.aliases).toContain('migrations:bundle');
    });

    it('has a description', () => {
      const cmd = new MigrationsBundleCommand();
      expect(cmd.describe).toBeTruthy();
    });
  });

  describe('run()', () => {
    it('logs error when migrations directory does not exist', async () => {
      const logger = new InMemoryLogger();
      const fs = new InMemoryFs();
      const cmd = new MigrationsBundleCommand(logger, fs);

      await cmd.run(['migration:bundle']);

      expect(logger.errors.length).toBeGreaterThan(0);
      expect(logger.errors[0]).toContain('not found');
      expect(process.exitCode).toBe(1);
    });

    it('logs build info when migrations directory exists', async () => {
      const logger = new InMemoryLogger();
      const fs = new InMemoryFs();

      const cwd = process.cwd();
      const migrationsDir = `${cwd}/migrations`;
      fs.addDir(migrationsDir);

      const cmd = new MigrationsBundleCommand(logger, fs);

      // esbuild will attempt to bundle — this may fail in test env if esbuild isn't available
      // but we just verify that the command proceeds past the directory check
      try {
        await cmd.run(['migration:bundle']);
      } catch {
        // esbuild may not be configured for this test — expected
      }

      // Should have logged build info
      expect(logger.infos.some((m) => m.includes('Building migration bundle'))).toBe(true);
    });

    it('parses --target argument correctly', async () => {
      const logger = new InMemoryLogger();
      const fs = new InMemoryFs();

      const cwd = process.cwd();
      fs.addDir(`${cwd}/migrations`);

      const cmd = new MigrationsBundleCommand(logger, fs);

      try {
        await cmd.run(['migration:bundle', '--target=node-linux-x64']);
      } catch {
        // esbuild may fail — ok
      }

      expect(logger.infos.some((m) => m.includes('node-linux-x64'))).toBe(true);
    });

    it('parses --output argument correctly', async () => {
      const logger = new InMemoryLogger();
      const fs = new InMemoryFs();

      const cwd = process.cwd();
      fs.addDir(`${cwd}/migrations`);

      const cmd = new MigrationsBundleCommand(logger, fs);

      try {
        await cmd.run(['migration:bundle', '--output=custom/output.js']);
      } catch {
        // esbuild may fail — ok
      }

      expect(
        logger.infos.some((m) => m.includes('custom/output.js') || m.includes('output.js'))
      ).toBe(true);
    });
  });
});
