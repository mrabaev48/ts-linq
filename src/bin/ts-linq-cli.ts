#!/usr/bin/env node
/* ts-linq CLI */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { NodeChecksumPort } from '../cli/runtime/nodeAdapters';
import { parseArgs } from '../cli/runtime/args';
import { makeEffectiveConfig } from '../cli/runtime/config';
import { loadBootstrapFiles, loadEntitiesFromGlobs } from '../cli/runtime/bootstrap';
import { CommandRegistry } from '../cli/runtime/registry';
import { StatusCommand } from '../cli/commands/status';
import { ConfigPrintCommand } from '../cli/commands/configPrint';
import { DiffCommand } from '../cli/commands/diff';
import { MigrateCommand } from '../cli/commands/migrate';
import { RollbackCommand } from '../cli/commands/rollback';
import { VerifyCommand } from '../cli/commands/verify';
import { InitCommand } from '../cli/commands/init';
import { DiffMigrationGenerator } from '../migrations/DiffMigrationGenerator';
import { MigrationRunner } from '../migrations/MigrationRunner';
import type { Migration } from '../migrations/Migration';
import { SQLiteProvider } from '../providers/SQLiteProvider';
import { PostgresProvider } from '../providers/PostgresProvider';
import { MySqlProvider } from '../providers/MySqlProvider';
import { MssqlProvider } from '../providers/MssqlProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SeedCommand } from '../cli/commands/seed';
import { GenerateEntityCommand } from '../cli/commands/generateEntity';
import { GenerateMigrationCommand } from '../cli/commands/generateMigration';

type ProviderId = 'sqlite' | 'postgresql' | 'mysql' | 'mssql';

interface Flags {
  provider?: ProviderId;
  conn?: string;
  json?: boolean;
  dryRun?: boolean;
  cwd?: string;
  toVersion?: string;
  step?: number;
  verbose?: boolean;
  quiet?: boolean;
  out?: string;
  create?: boolean;
}

interface CliConfig {
  provider?: ProviderId;
  connectionString?: string | { env: string };
  migrationsDir?: string;
  seedsDir?: string;
  entitiesGlobs?: string[];
  metrics?: { enabled?: boolean };
  bootstrap?: string[];
}

interface EffectiveConfig {
  provider: ProviderId;
  connectionString: string;
  migrationsDir: string;
  seedsDir: string;
  entitiesGlobs: string[];
  metrics: { enabled: boolean };
  bootstrap: string[];
}

// parseArgs moved to ../cli/runtime/args

function printHelp(): void {
  const usage = `
ts-linq CLI

Usage:
  ts-linq <command> [options]

Commands:
  help                              Show this help
  version                           Show CLI version
  init                              Initialize config and directories
  status [--json]                   Show migrations status
  diff [--json] [--details]         Show schema diff (does not modify DB)
       [--out <file>]               Write SQL plan to file
       [--create] [--name <Class>]  Create migration scaffold (optional class name)
  generate migration <Name>         Create a migration file in migrations/
  generate entity <Name>            Create an entity class in src/entities/ (flags: --dir, --pk, --columns)
  migrate [--dry-run]               Apply schema diff (temporary shortcut)
  apply-diff                        Same as migrate (temporary)
  seed [--file <path>]              Apply SQL seed file
  config print                      Print effective configuration
  rollback [--to <version>]         Rollback applied migrations down to target version
  verify [--json] [--dry-run]       Verify migrations checksum baseline

Global options:
  --provider=<sqlite|postgresql|mysql|mssql>
  --conn=<connectionString>
  --json    Output JSON when supported
  --details Include expected/actual/diff snapshots in JSON (for diff)
  --dry-run Do not execute, only print SQL where applicable
  --verbose Verbose logging
  --quiet   Suppress non-error output

Command-specific options:
  diff:
    --out=<file>      Write generated SQL to a file
    --create          Create a migration scaffold from the current diff
    --name=<Class>    Custom class/file suffix for scaffolded migration
  generate entity:
    --dir=<path>      Target directory (default: src/entities)
    --pk=<name>       Primary key property name (default: id)
    --columns=a:TYPE,b:TYPE?  Extra columns (use ? for nullable)

Examples:
  ts-linq init
  ts-linq diff --json --details --provider=sqlite --conn=:memory:
  ts-linq diff --create --name=InitSchema
  ts-linq migrate --dry-run
  ts-linq verify --json --dry-run
`;
  console.log(usage);
}

function printVersion(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json') as { version?: string };
    console.log(pkg.version ?? 'unknown');
  } catch {
    console.log('unknown');
  }
}

function createProvider(id: ProviderId, conn: string) {
  switch (id) {
    case 'sqlite':
      return new SQLiteProvider(conn);
    case 'postgresql':
      return new PostgresProvider(conn);
    case 'mysql':
      return new MySqlProvider(conn);
    case 'mssql':
      return new MssqlProvider(conn);
    default:
      return new SQLiteProvider(conn);
  }
}

// resolveConnectionString inlined in runtime/config

function tryRequire(modulePath: string): unknown | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(modulePath);
  } catch {
    return undefined;
  }
}

// loadEntitiesFromGlobs moved to ../cli/runtime/bootstrap

// loadBootstrapFiles moved to ../cli/runtime/bootstrap

// loadUserConfig moved to ../cli/runtime/config

// makeEffectiveConfig moved to ../cli/runtime/config

async function tryLoadMigrations(
  migrationsDir: string,
  provider: ReturnType<typeof createProvider>
): Promise<Migration[] | undefined> {
  const indexCandidates = ['index.ts', 'index.js', 'index.cjs', 'index.mjs'];
  for (const name of indexCandidates) {
    const p = path.resolve(migrationsDir, name);
    if (!fs.existsSync(p)) continue;
    if (name.endsWith('.ts')) {
      tryRequire('ts-node/register/transpile-only');
    }
    const mod = tryRequire(p) as
      | { default?: unknown; loadMigrations?: (provider: unknown) => Promise<Migration[] | Migration[]> }
      | undefined;
    if (!mod) continue;
    const loader = (mod as { loadMigrations?: (provider: unknown) => Promise<Migration[] | Migration[]> })
      .loadMigrations;
    if (typeof loader === 'function') {
      const res = await Promise.resolve(loader(provider));
      return Array.isArray(res) ? (res as Migration[]) : undefined;
    }
    const def = (mod as { default?: unknown }).default;
    if (Array.isArray(def)) {
      return def as Migration[];
    }
  }
  return undefined;
}

async function cmdStatus(flags: Flags): Promise<number> {
  const effective = makeEffectiveConfig(flags);
  const provider = createProvider(effective.provider, effective.connectionString);
  await provider.connect();
  const runner = new MigrationRunner(provider);
  await runner.ensureMigrationTableExists();
  const list = await runner.getAppliedMigrations();
  await provider.disconnect();
  if (flags.json) {
    console.log(JSON.stringify({ provider: effective.provider, applied: list }, null, 2));
  } else {
    if (!flags.quiet) {
      if (list.length === 0) {
        console.log('No migrations applied');
      } else {
        for (const m of list) console.log(`${m.version} ${m.name} @ ${m.appliedAt.toISOString()}`);
      }
    }
  }
  return 0;
}

// generate migration moved to command

async function cmdSeed(fileArg?: string, flags?: Flags): Promise<number> {
  const effective = makeEffectiveConfig(flags || {});
  const provider = createProvider(effective.provider, effective.connectionString);
  await provider.connect();
  const defaultSeed = path.resolve(effective.seedsDir, 'seeds.sql');
  const sqlFile = fileArg ? path.resolve(process.cwd(), fileArg) : defaultSeed;
    if (!fs.existsSync(sqlFile)) {
      console.error(`Seed file not found: ${sqlFile}`);
    await provider.disconnect();
    return 2;
  }
      const text = fs.readFileSync(sqlFile, 'utf8');
      const statements = text
        .split(';')
        .map((stmt) => stmt.trim())
        .filter(Boolean);
      for (const statement of statements) {
        // eslint-disable-next-line no-await-in-loop
        await provider.executeNonQuery(statement);
      }
      if (!flags?.quiet) console.log(`Applied ${statements.length} seed statements from ${sqlFile}`);
  await provider.disconnect();
  return 0;
}

async function cmdMigrate(flags: Flags): Promise<number> {
  const effective = makeEffectiveConfig(flags);
  // Load bootstrap and entities upfront to ensure metadata is registered regardless of path taken
  await loadBootstrapFiles(effective.bootstrap, flags.cwd || process.cwd());
  await loadEntitiesFromGlobs(effective.entitiesGlobs, flags.cwd || process.cwd());
  const provider = createProvider(effective.provider, effective.connectionString);
  await provider.connect();
  // Attempt to load explicit migrations from migrationsDir/index.*
  const explicit = await tryLoadMigrations(effective.migrationsDir, provider);
  if (explicit && explicit.length > 0) {
    const runner = new MigrationRunner(provider);
    // Determine applied and pending
    await runner.ensureMigrationTableExists();
    const applied = await runner.getAppliedMigrations();
    const appliedSet = new Set(applied.map((a) => a.version));
    const sorted = [...explicit].sort((a, b) => a.getVersion().localeCompare(b.getVersion()));
    let pending = sorted.filter((m) => !appliedSet.has(m.getVersion()));
    // Apply target filtering
    if (flags.toVersion) {
      pending = pending.filter((m) => m.getVersion() <= flags.toVersion!);
    }
    if (typeof flags.step === 'number' && Number.isFinite(flags.step) && flags.step! > 0) {
      pending = pending.slice(0, flags.step);
    }
    if (flags.dryRun) {
      console.log(
        JSON.stringify(
          {
            applied: applied.map((a) => a.version),
            pending: pending.map((m) => m.getVersion())
          },
          null,
          2
        )
      );
    } else {
      for (const m of pending) runner.addMigration(m);
      if (flags.verbose && !flags.quiet)
        console.log(`Applying ${pending.length} migration(s)`);
      await runner.migrate();
    }
    await provider.disconnect();
    return 0;
  }
  // Fallback: diff of the current schema
  const gen = new DiffMigrationGenerator(provider);
  const steps = await gen.generate();
  if (flags.dryRun) {
    if (flags.json) {
      console.log(JSON.stringify({ steps: steps.map((s) => s.sql) }, null, 2));
    } else {
      for (const step of steps) console.log(step.sql);
    }
    await provider.disconnect();
    return 0;
  }
  for (const step of steps) {
    if (!step.sql.trim().startsWith('--')) {
      // eslint-disable-next-line no-await-in-loop
      if (flags.verbose && !flags.quiet) console.log(`EXEC: ${step.sql}`);
      await provider.executeNonQuery(step.sql);
    }
  }
  if (!flags.quiet) console.log(`Applied ${steps.length} step(s).`);
  await provider.disconnect();
  return 0;
}

async function cmdRollback(flags: Flags): Promise<number> {
  const effective = makeEffectiveConfig(flags);
  const provider = createProvider(effective.provider, effective.connectionString);
  await provider.connect();
  const explicit = await tryLoadMigrations(effective.migrationsDir, provider);
  const runner = new MigrationRunner(provider);
  if (explicit) for (const m of explicit) runner.addMigration(m);
  await runner.ensureMigrationTableExists();
  await runner.rollback(flags.toVersion);
  await provider.disconnect();
  return 0;
}

async function cmdConfigPrint(flags: Flags): Promise<number> {
  const effective = makeEffectiveConfig(flags);
  console.log(
    JSON.stringify(
      {
        provider: effective.provider,
        connectionString: effective.connectionString,
        migrationsDir: effective.migrationsDir,
        seedsDir: effective.seedsDir,
        entitiesGlobs: effective.entitiesGlobs,
        metrics: effective.metrics
      },
      null,
      2
    )
  );
  return 0;
}

async function cmdDiff(flags: Flags): Promise<number> {
  const effective = makeEffectiveConfig(flags);
  await loadBootstrapFiles(effective.bootstrap, flags.cwd || process.cwd());
  await loadEntitiesFromGlobs(effective.entitiesGlobs, flags.cwd || process.cwd());
  const provider = createProvider(effective.provider, effective.connectionString);
  await provider.connect();
  const gen = new DiffMigrationGenerator(provider);
  const steps = await gen.generate();
  await provider.disconnect();
  if (flags.create) {
    const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const dir = effective.migrationsDir;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${ts}_Diff.ts`);
    const bodyLines = steps.map((s, i) => `    // ${i + 1}) ${s.sql}`);
    const template = `import { Migration } from '../src/migrations/Migration';\n\nexport class Diff_${ts} extends Migration {\n  protected get name() { return 'Diff_${ts}'; }\n  protected get version() { return '${ts}'; }\n  public async up(): Promise<void> {\n${bodyLines.join('\n')}\n    // TODO: execute these statements using your provider\n  }\n  public async down(): Promise<void> {\n    // TODO: add rollback for the above changes if needed\n  }\n}\n`;
    fs.writeFileSync(file, template, 'utf8');
    if (flags.json) {
      console.log(JSON.stringify({ file, steps: steps.map((s) => s.sql) }, null, 2));
    } else if (!flags.quiet) {
      console.log(`Created migration scaffold: ${file}`);
    }
    return 0;
  }
  if (flags.json) {
    console.log(JSON.stringify({ steps: steps.map((s) => s.sql) }, null, 2));
    return 0;
  }
  if (flags.out) {
    const outPath = path.resolve(flags.cwd || process.cwd(), flags.out);
    fs.writeFileSync(outPath, steps.map((s) => s.sql).join('\n') + '\n', 'utf8');
    if (!flags.quiet) console.log(`Written ${steps.length} step(s) to ${outPath}`);
    return 0;
  }
  for (const step of steps) console.log(step.sql);
  return 0;
}

async function cmdInit(flags: Flags): Promise<number> {
  const cwd = flags.cwd || process.cwd();
  const cfgPath = path.resolve(cwd, 'tslinq.config.json');
  const migrationsDir = path.resolve(cwd, 'migrations');
  const seedsDir = path.resolve(cwd, 'seeds');
  // Create config if not exists
  if (!fs.existsSync(cfgPath)) {
    const cfg = {
      provider: 'sqlite',
      connectionString: ':memory:',
      migrationsDir: 'migrations',
      seedsDir: 'seeds',
      entitiesGlobs: []
    } as CliConfig;
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    if (!flags.quiet) console.log(`Created ${cfgPath}`);
  } else if (!flags.quiet) {
    console.log(`Config already exists: ${cfgPath}`);
  }
  // Create directories
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    if (!flags.quiet) console.log(`Created ${migrationsDir}`);
  }
  if (!fs.existsSync(seedsDir)) {
    fs.mkdirSync(seedsDir, { recursive: true });
    if (!flags.quiet) console.log(`Created ${seedsDir}`);
  }
  // Seed example file
  const seedsSql = path.join(seedsDir, 'seeds.sql');
  if (!fs.existsSync(seedsSql)) {
    fs.writeFileSync(
      seedsSql,
      '-- Example seed file\n-- CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL);\n',
      'utf8'
    );
    if (!flags.quiet) console.log(`Created ${seedsSql}`);
  }
  return 0;
}

function findMigrationsIndex(migrationsDir: string): string | undefined {
  const indexCandidates = ['index.ts', 'index.js', 'index.cjs', 'index.mjs'];
  for (const name of indexCandidates) {
    const p = path.resolve(migrationsDir, name);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function computeFileSha256(filePath: string): string {
  // Delegate to port to conform to DIP; keep fallback for safety
  try {
    const port = new NodeChecksumPort();
    return port.sha256(filePath);
  } catch {
    const data = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }
}

async function cmdVerify(flags: Flags): Promise<number> {
  const effective = makeEffectiveConfig(flags);
  const indexPath = findMigrationsIndex(effective.migrationsDir);
  if (!indexPath) {
    if (flags.json) {
      console.log(JSON.stringify({ ok: true, reason: 'no_explicit_migrations' }, null, 2));
    } else if (!flags.quiet) {
      console.log('No explicit migrations index found');
    }
    return 0;
  }
  const checksum = computeFileSha256(indexPath);
  const baselineFile = path.join(effective.migrationsDir, '.tslinq.checksum');
  if (!fs.existsSync(baselineFile)) {
    if (flags.dryRun) {
      if (flags.json) {
        console.log(JSON.stringify({ ok: true, action: 'would_create_baseline', checksum }, null, 2));
      } else if (!flags.quiet) {
        console.log('Baseline would be created');
      }
      return 0;
    }
    fs.writeFileSync(baselineFile, checksum, 'utf8');
    if (flags.json) {
      console.log(JSON.stringify({ ok: true, action: 'baseline_created', checksum }, null, 2));
    } else if (!flags.quiet) {
      console.log('Baseline created');
    }
    return 0;
  }
  const stored = fs.readFileSync(baselineFile, 'utf8').trim();
  if (stored === checksum) {
    if (flags.json) {
      console.log(JSON.stringify({ ok: true, checksum }, null, 2));
    } else if (!flags.quiet) {
      console.log('Verify OK');
    }
    return 0;
  }
  if (flags.json) {
    console.log(JSON.stringify({ ok: false, stored, current: checksum }, null, 2));
  } else {
    console.error('Checksum mismatch');
  }
  return 3;
}

async function main() {
  const { cmd, rest, flags } = parseArgs(process.argv.slice(2));
  const command = cmd || 'help';
  const registry = new CommandRegistry();
  registry.register('status', new StatusCommand());
  registry.register('config', new ConfigPrintCommand());
  registry.register('diff', new DiffCommand());
  registry.register('migrate', new MigrateCommand());
  registry.register('apply-diff', new MigrateCommand());
  registry.register('rollback', new RollbackCommand());
  registry.register('verify', new VerifyCommand());
  registry.register('init', new InitCommand());
  registry.register('seed', new SeedCommand());
  registry.register('generate:entity', new GenerateEntityCommand());
  registry.register('generate:migration', new GenerateMigrationCommand());

  const run = async (name: string): Promise<void> => {
    const handler = registry.get(name);
    if (!handler) {
      printHelp();
      process.exitCode = 2;
      return;
    }
    try {
      const code = await handler.execute(rest, flags);
      if (typeof code === 'number') process.exitCode = code;
    } catch (err) {
      if (flags.json) {
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            { ok: false, error: (err as Error)?.message ?? String(err) },
            null,
            2
          )
        );
      } else {
        // eslint-disable-next-line no-console
        console.error(err);
      }
      process.exitCode = 1;
    }
  };
  switch (command) {
    case 'help':
      printHelp();
      return;
    case 'version':
      printVersion();
      return;
    case 'status':
      await run('status');
      return;
    case 'generate':
      if (rest[0] === 'migration') { await run('generate:migration'); return; }
      if (rest[0] === 'entity') {
        const name = rest[1] || 'Entity';
        await run('generate:entity');
        return;
      }
      console.error('Only "generate migration <Name>" or "generate entity <Name>" are supported at the moment');
      process.exitCode = 2;
      return;
    case 'config':
      await run('config');
      return;
    case 'init':
      await run('init');
      return;
    case 'diff':
      await run('diff');
      return;
    case 'seed':
      await run('seed');
      return;
    case 'migrate':
    case 'apply-diff':
      await run(command);
      return;
    case 'rollback':
      await run('rollback');
      return;
    case 'verify':
      await run('verify');
      return;
    default:
      // Unknown command → show help and non-zero exit
      printHelp();
      process.exitCode = 2;
      return;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
