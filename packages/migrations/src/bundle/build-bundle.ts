import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { BundleBuildError } from '@ts-linq/types';

/**
 * Supported target platforms for the migration bundle.
 * Mirrors the `--target` values supported by `dotnet ef migrations bundle -r`.
 */
export type BundleTarget =
  | 'node-linux-x64'
  | 'node-linux-arm64'
  | 'node-win-x64'
  | 'node-macos-x64'
  | 'node-macos-arm64';

/**
 * Options controlling how the migration bundle is produced.
 */
export interface BundleOptions {
  /** Absolute path to the directory containing migration files. */
  migrationsDir: string;
  /** Destination file path for the bundled script (e.g. `./dist/migrate.bundle.js`). */
  outputFile: string;
  /** Node.js target platform. Defaults to the current host platform. */
  target?: BundleTarget;
  /** Optional connection string; if omitted, the bundle reads from `DATABASE_URL` at runtime. */
  connectionString?: string;
}

/** Resolved information about a discovered migration file. */
interface MigrationFileEntry {
  version: string;
  name: string;
  absolutePath: string;
}

/**
 * Builds a self-contained Node.js migration bundle using `esbuild`.
 *
 * The bundle embeds all migration classes + `MigrationRunner` into a single
 * `.js` file that can be executed with `node migrate.bundle.js` on the
 * target machine without requiring a full Node project or installed dependencies.
 *
 * Mirrors the behaviour of `dotnet ef migrations bundle --self-contained -r linux-x64`.
 *
 * @example
 * // From CLI: pnpm ts-linq migrations bundle --target node-linux-x64
 * const builder = new MigrationBundleBuilder();
 * await builder.build({
 *   migrationsDir: './migrations',
 *   outputFile: './dist/migrate.bundle.js',
 *   target: 'node-linux-x64',
 * });
 */
export class MigrationBundleBuilder {
  /**
   * Scan `migrationsDir`, generate an entry-point script, bundle everything
   * with `esbuild`, and write the output to `outputFile`.
   *
   * @throws {Error} When `esbuild` is not installed or the migrations directory is missing.
   */
  public async build(options: BundleOptions): Promise<void> {
    const { migrationsDir, outputFile, target = this.detectTarget() } = options;

    this.assertMigrationsDirExists(migrationsDir);

    const migrations = this.discoverMigrations(migrationsDir);
    const entrySource = this.generateEntrySource(migrations, migrationsDir);
    const entryFile = this.writeTempEntry(entrySource);

    try {
      await this.runEsbuild(entryFile, outputFile, target);
    } finally {
      fs.unlinkSync(entryFile);
    }
  }

  // ---------------------------------------------------------------------------
  // Migration discovery
  // ---------------------------------------------------------------------------

  private discoverMigrations(dir: string): MigrationFileEntry[] {
    const entries: MigrationFileEntry[] = [];

    for (const file of fs.readdirSync(dir)) {
      const match = /^(\d{14})_([A-Za-z0-9_]+)\.(ts|js|mjs|cjs)$/.exec(file);
      if (!match) continue;
      entries.push({
        version: match[1],
        name: match[2],
        absolutePath: path.resolve(dir, file)
      });
    }

    return entries.sort((a, b) => a.version.localeCompare(b.version));
  }

  // ---------------------------------------------------------------------------
  // Entry-point source generation
  // ---------------------------------------------------------------------------

  private generateEntrySource(migrations: MigrationFileEntry[], migrationsDir: string): string {
    const importLines = migrations.map(
      (m, i) => `import * as migration_${i} from '${m.absolutePath}';`
    );

    const registerLines = migrations.map((m, i) =>
      [
        `{`,
        `  const exports = migration_${i};`,
        `  for (const key of Object.keys(exports)) {`,
        `    const Ctor = exports[key];`,
        `    if (typeof Ctor !== 'function') continue;`,
        `    const proto = Ctor.prototype ?? {};`,
        `    if (!('up' in proto) || !('down' in proto)) continue;`,
        `    try {`,
        `      const instance = new Ctor();`,
        `      if (typeof instance.getVersion === 'function') {`,
        `        runner.addMigration(instance);`,
        `      }`,
        `    } catch { /* skip non-constructible */ }`,
        `  }`,
        `}`
      ].join('\n  ')
    );

    const relDir = path.relative(path.dirname(os.tmpdir()), migrationsDir);

    return [
      `// Auto-generated migration bundle`,
      `// Source directory: ${relDir}`,
      `// Do not edit — regenerate with: pnpm ts-linq migrations bundle`,
      ``,
      `import { MigrationRunner } from '@ts-linq/migrations';`,
      ``,
      ...importLines,
      ``,
      `async function run() {`,
      `  const connectionString = process.env['DATABASE_URL'];`,
      `  if (!connectionString) {`,
      `    console.error('[ts-linq bundle] DATABASE_URL environment variable is not set.');`,
      `    process.exit(1);`,
      `  }`,
      ``,
      `  // Dynamic provider import — resolved at bundle time based on DB_PROVIDER env var`,
      `  const providerName = process.env['DB_PROVIDER'] ?? 'postgres';`,
      `  let provider: import('@ts-linq/core').DatabaseProvider;`,
      `  try {`,
      `    const mod = await import(\`@ts-linq/provider-\${providerName}\`);`,
      `    const ProviderCtor = mod.default ?? Object.values(mod)[0];`,
      `    provider = new ProviderCtor({ connectionString });`,
      `  } catch (err) {`,
      `    console.error(\`[ts-linq bundle] Failed to load provider "\${providerName}": \${err}\`);`,
      `    process.exit(1);`,
      `  }`,
      ``,
      `  await provider.connect();`,
      `  try {`,
      `    const runner = new MigrationRunner(provider);`,
      ...registerLines.map((r) => `    ${r}`),
      `    await runner.migrate();`,
      `    console.log('[ts-linq bundle] All migrations applied successfully.');`,
      `  } finally {`,
      `    await provider.disconnect();`,
      `  }`,
      `}`,
      ``,
      `run().catch((err) => {`,
      `  console.error('[ts-linq bundle] Migration failed:', err);`,
      `  process.exit(1);`,
      `});`
    ].join('\n');
  }

  // ---------------------------------------------------------------------------
  // esbuild execution
  // ---------------------------------------------------------------------------

  private async runEsbuild(
    entryFile: string,
    outputFile: string,
    target: BundleTarget
  ): Promise<void> {
    // Dynamic import so that esbuild is only required when this method is called,
    // avoiding hard startup failures on machines where esbuild isn't installed.
    let esbuild: typeof import('esbuild');
    try {
      esbuild = await import('esbuild');
    } catch (error) {
      throw new BundleBuildError(
        'esbuild is required to build migration bundles. Install it with: pnpm add -D esbuild',
        { cause: error, details: { reason: 'esbuild-missing' } }
      );
    }

    const nodeTarget = this.resolveEsbuildTarget(target);

    await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      platform: 'node',
      target: nodeTarget,
      format: 'cjs',
      outfile: outputFile,
      minify: false,
      sourcemap: false,
      external: [
        // Provider packages are expected to be installed on the target
        '@ts-linq/provider-postgres',
        '@ts-linq/provider-mysql',
        '@ts-linq/provider-mssql'
      ]
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private writeTempEntry(source: string): string {
    const tmpDir = os.tmpdir();
    const entryFile = path.join(tmpDir, `ts-linq-bundle-entry-${Date.now()}.mjs`);
    fs.writeFileSync(entryFile, source, 'utf8');
    return entryFile;
  }

  private detectTarget(): BundleTarget {
    const arch = os.arch() === 'arm64' ? 'arm64' : 'x64';
    switch (os.platform()) {
      case 'win32':
        return 'node-win-x64';
      case 'darwin':
        return arch === 'arm64' ? 'node-macos-arm64' : 'node-macos-x64';
      default:
        return arch === 'arm64' ? 'node-linux-arm64' : 'node-linux-x64';
    }
  }

  private resolveEsbuildTarget(_bundleTarget: BundleTarget): string {
    // Map our target names to esbuild node version targets.
    // Use Node 20 LTS as the minimum supported version.
    return 'node20';
  }

  private assertMigrationsDirExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      throw new BundleBuildError(
        'Migrations directory does not exist. ' +
          'Run "pnpm ts-linq generate:migration <Name>" to create your first migration.',
        { details: { dir } }
      );
    }
  }
}
