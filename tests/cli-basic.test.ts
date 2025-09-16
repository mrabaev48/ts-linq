import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function runCli(args: string[], options?: { env?: NodeJS.ProcessEnv }) {
  const node = process.execPath;
  const cliPath = path.resolve(__dirname, '..', 'src', 'bin', 'ts-linq-cli.ts');
  const result = cp.spawnSync(node, ['-r', 'ts-node/register/transpile-only', cliPath, ...args], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, ...(options?.env || {}) },
    encoding: 'utf8'
  });
  return { code: result.status ?? 0, stdout: result.stdout, stderr: result.stderr };
}

describe('CLI basic', () => {
  test('help prints usage', () => {
    const r = runCli(['help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('ts-linq CLI');
    expect(r.stdout).toContain('Commands:');
  });

  test('version prints semver or unknown', () => {
    const r = runCli(['version']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toMatch(/^(\d+\.\d+\.\d+|unknown)$/);
  });

  test('config print reflects config file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const cfg = {
      provider: 'sqlite',
      connectionString: ':memory:',
      migrationsDir: 'migs',
      seedsDir: 'seeds',
      entitiesGlobs: []
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');
    const r = runCli(['config', `--cwd=${tmp}`]);
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.provider).toBe('sqlite');
    expect(out.connectionString).toBe(':memory:');
    expect(out.migrationsDir).toBe(path.resolve(tmp, 'migs'));
    expect(out.seedsDir).toBe(path.resolve(tmp, 'seeds'));
  });

  test('status on in-memory sqlite shows no migrations', () => {
    const r = runCli(['status']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/No migrations applied|^$/);
  });

  test('seed applies SQL from seeds/seeds.sql', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const seedsDir = path.join(tmp, 'seeds');
    fs.mkdirSync(seedsDir);
    const sql = 'CREATE TABLE IF NOT EXISTS t(x INTEGER); INSERT INTO t(x) VALUES (1);';
    fs.writeFileSync(path.join(seedsDir, 'seeds.sql'), sql, 'utf8');
    const dbPath = path.join(tmp, 'cli-seed.db');
    const r = runCli(['seed', `--provider=sqlite`, `--conn=${dbPath}`, `--cwd=${tmp}`]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('Applied');
  });
});
