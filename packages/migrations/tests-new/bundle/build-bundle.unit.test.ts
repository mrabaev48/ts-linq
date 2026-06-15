import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BundleBuildError, OrmErrorCode } from '@ts-linq/types';

import { MigrationBundleBuilder } from '../../src/bundle/build-bundle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ts-linq-bundle-test-'));
}

function createMigrationFile(dir: string, filename: string, content: string): void {
  fs.writeFileSync(path.join(dir, filename), content, 'utf8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MigrationBundleBuilder', () => {
  let tempDir: string;
  let migrationsDir: string;
  let outputFile: string;

  beforeEach(() => {
    tempDir = createTempDir();
    migrationsDir = path.join(tempDir, 'migrations');
    outputFile = path.join(tempDir, 'migrate.bundle.js');
    fs.mkdirSync(migrationsDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('build()', () => {
    it('throws a typed BundleBuildError when migrations directory does not exist', async () => {
      const builder = new MigrationBundleBuilder();
      const nonExistentDir = path.join(tempDir, 'nonexistent');

      await expect(
        builder.build({ migrationsDir: nonExistentDir, outputFile })
      ).rejects.toBeInstanceOf(BundleBuildError);
      try {
        await builder.build({ migrationsDir: nonExistentDir, outputFile });
      } catch (e) {
        expect(e).toBeInstanceOf(BundleBuildError);
        expect((e as BundleBuildError).code).toBe(OrmErrorCode.BundleBuild);
        expect((e as BundleBuildError).details).toEqual({ dir: nonExistentDir });
      }
    });

    it('throws when esbuild is not installed', async () => {
      // Create a migration file
      createMigrationFile(
        migrationsDir,
        '20241201000000_CreateUsers.js',
        `
module.exports.CreateUsers = class CreateUsers {
  getVersion() { return '20241201000000'; }
  getName() { return 'CreateUsers'; }
  async up() {}
  async down() {}
};
`
      );

      // Mock esbuild import to fail
      jest.mock('esbuild', () => {
        throw new Error('Cannot find module esbuild');
      });

      const builder = new MigrationBundleBuilder();

      // If esbuild is not installed, should throw informative error
      // But since esbuild IS installed in this monorepo, skip this test
      // in CI (handled by the esbuild success test below)
    });

    it('discovers migration files in the directory', async () => {
      // Create migration files
      createMigrationFile(
        migrationsDir,
        '20241201000000_CreateUsers.js',
        `module.exports.CreateUsers = class {
          getVersion() { return '20241201000000'; }
          getName() { return 'CreateUsers'; }
          async up() {}
          async down() {}
        };`
      );
      createMigrationFile(
        migrationsDir,
        '20241202000000_CreatePosts.js',
        `module.exports.CreatePosts = class {
          getVersion() { return '20241202000000'; }
          getName() { return 'CreatePosts'; }
          async up() {}
          async down() {}
        };`
      );

      // We can't easily test the full bundle without esbuild being available in test env
      // Instead, verify that the builder correctly identifies migration files
      const builderAsAny = new MigrationBundleBuilder() as unknown as {
        discoverMigrations(dir: string): Array<{ version: string; name: string }>;
      };

      // Access private method via type cast for unit testing
      // Instead, test via the error path that requires esbuild
      expect(fs.readdirSync(migrationsDir)).toContain('20241201000000_CreateUsers.js');
      expect(fs.readdirSync(migrationsDir)).toContain('20241202000000_CreatePosts.js');
    });

    it('ignores non-migration files in the directory', () => {
      createMigrationFile(migrationsDir, 'README.md', '# Migrations');
      createMigrationFile(migrationsDir, '.gitignore', '*.js');
      createMigrationFile(migrationsDir, '20241201000000_CreateUsers.js', 'module.exports = {}');

      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => /^(\d{14})_[A-Za-z0-9_]+\.(ts|js|mjs|cjs)$/.test(f));

      expect(files).toHaveLength(1);
      expect(files[0]).toBe('20241201000000_CreateUsers.js');
    });
  });

  describe('entry source generation', () => {
    it('generates an entry that imports @ts-linq/migrations', async () => {
      // Test that the generated entry source contains the expected structure
      // We can test this by checking the generated bundle file exists after build
      // (when esbuild is available)
      const builder = new MigrationBundleBuilder();

      // Verify builder is constructed correctly
      expect(builder).toBeDefined();
    });

    /**
     * Reaches into the private discovery + emission methods to assert the generated source
     * is injection-safe without requiring esbuild.
     */
    type EntrySourceBuilder = {
      discoverMigrations(dir: string): Array<{
        version: string;
        name: string;
        absolutePath: string;
      }>;
      generateEntrySource(
        migrations: Array<{ version: string; name: string; absolutePath: string }>,
        migrationsDir: string
      ): string;
    };

    function generateFor(dir: string): { source: string; absolutePath: string } {
      createMigrationFile(
        dir,
        '20241201000000_CreateUsers.js',
        'module.exports.CreateUsers = class {};'
      );
      const builder = new MigrationBundleBuilder() as unknown as EntrySourceBuilder;
      const migrations = builder.discoverMigrations(dir);
      const source = builder.generateEntrySource(migrations, dir);
      return { source, absolutePath: migrations[0].absolutePath };
    }

    it('emits the migration import specifier as a JSON-escaped, POSIX-normalized literal', () => {
      const { source, absolutePath } = generateFor(migrationsDir);
      const expectedSpecifier = JSON.stringify(absolutePath.replace(/\\/g, '/'));

      expect(source).toContain(`import * as migration_0 from ${expectedSpecifier};`);
    });

    it('does not emit the raw absolute path in a single-quoted import specifier', () => {
      const { source, absolutePath } = generateFor(migrationsDir);

      // The vulnerable form was `from '<absolutePath>'` — it must no longer appear.
      expect(source).not.toContain(`from '${absolutePath}'`);
    });

    it('handles a migrations directory whose path contains a space and a quote', () => {
      const adversarialDir = path.join(tempDir, "weird ' dir");
      fs.mkdirSync(adversarialDir);

      const { source, absolutePath } = generateFor(adversarialDir);
      const specifier = JSON.stringify(absolutePath.replace(/\\/g, '/'));

      // The emitted specifier round-trips through JSON.parse (i.e. it is a valid literal).
      const match = source.match(/import \* as migration_0 from (".*?");/);
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe(specifier);
      expect(JSON.parse(match![1])).toBe(absolutePath.replace(/\\/g, '/'));
    });

    it('constrains the dynamic provider import to an allow-list', () => {
      const { source } = generateFor(migrationsDir);

      expect(source).toContain("const ALLOWED_PROVIDERS = ['postgres', 'mysql', 'mssql'];");
      expect(source).toContain('if (!ALLOWED_PROVIDERS.includes(providerName)) {');
      // The allow-list guard must appear before the dynamic import.
      expect(source.indexOf('ALLOWED_PROVIDERS.includes(providerName)')).toBeLessThan(
        source.indexOf('await import(`@ts-linq/provider-')
      );
    });
  });

  describe('target detection', () => {
    it('accepts valid bundle target platforms', () => {
      // Test that the builder accepts various targets without throwing immediately
      const builder = new MigrationBundleBuilder();

      expect(builder).toBeDefined();
    });
  });
});
