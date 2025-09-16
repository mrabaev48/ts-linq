import * as fs from 'fs';
import * as path from 'path';
import type { CliConfig, EffectiveConfig, Flags, ProviderId } from './types';

function resolveConnectionString(input?: string | { env: string }): string | undefined {
  if (!input) return undefined;
  if (typeof input === 'string') return input;
  const envVar = input.env;
  return process.env[envVar];
}

function tryRequire(modulePath: string): unknown | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(modulePath);
  } catch {
    return undefined;
  }
}

export function loadUserConfig(cwd: string): { config?: CliConfig; path?: string } {
  const candidates = [
    'tslinq.config.ts',
    'tslinq.config.js',
    'tslinq.config.cjs',
    'tslinq.config.mjs',
    'tslinq.config.json'
  ];
  for (const name of candidates) {
    const p = path.resolve(cwd, name);
    if (!fs.existsSync(p)) continue;
    if (name.endsWith('.ts')) {
      tryRequire('ts-node/register/transpile-only');
    }
    if (name.endsWith('.json')) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const json = JSON.parse(raw) as CliConfig;
        return { config: json, path: p };
      } catch {
        return { config: undefined, path: p };
      }
    }
    const mod = tryRequire(p) as { default?: CliConfig } | CliConfig | undefined;
    if (!mod) return { config: undefined, path: p };
    const cfg = (mod as { default?: CliConfig }).default ?? (mod as CliConfig);
    return { config: cfg, path: p };
  }
  return {};
}

export function makeEffectiveConfig(flags: Flags): EffectiveConfig {
  const cwd = flags.cwd || process.cwd();
  const { config: fileConfig } = loadUserConfig(cwd);
  const envProvider = process.env.PROVIDER as ProviderId | undefined;
  const envConn =
    process.env.POSTGRES_URL ||
    process.env.MYSQL_URL ||
    process.env.MSSQL_URL ||
    process.env.SQLITE_URL;
  const provider: ProviderId = flags.provider || fileConfig?.provider || envProvider || 'sqlite';
  const cfgConn = resolveConnectionString(fileConfig?.connectionString);
  const connectionString = flags.conn || cfgConn || envConn || ':memory:';
  const migrationsDir = fileConfig?.migrationsDir
    ? path.resolve(cwd, fileConfig.migrationsDir)
    : path.resolve(cwd, 'migrations');
  const seedsDir = fileConfig?.seedsDir
    ? path.resolve(cwd, fileConfig.seedsDir)
    : path.resolve(cwd, 'seeds');
  const entitiesGlobs = fileConfig?.entitiesGlobs ?? [];
  const metrics = { enabled: Boolean(fileConfig?.metrics?.enabled) };
  const bootstrap = fileConfig?.bootstrap ?? [];
  return { provider, connectionString, migrationsDir, seedsDir, entitiesGlobs, metrics, bootstrap };
}
