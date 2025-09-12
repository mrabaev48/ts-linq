import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function runCli(args: string[]) {
  const node = process.execPath;
  const cliPath = path.resolve(__dirname, '..', 'src', 'bin', 'ts-linq-cli.ts');
  const result = cp.spawnSync(
    node,
    ['-r', 'ts-node/register/transpile-only', cliPath, ...args],
    {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env },
      encoding: 'utf8'
    }
  );
  return { code: result.status ?? 0, stdout: result.stdout, stderr: result.stderr };
}

describe('CLI verbosity flags', () => {
  test('status --quiet suppresses output', () => {
    const r = runCli(['status', '--quiet']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  test('seed --quiet suppresses applied message', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const seedsDir = path.join(tmp, 'seeds');
    fs.mkdirSync(seedsDir);
    fs.writeFileSync(path.join(seedsDir, 'seeds.sql'), 'CREATE TABLE t(x INTEGER);', 'utf8');
    const dbPath = path.join(tmp, 'cli-quiet.db');
    const r = runCli(['seed', `--provider=sqlite`, `--conn=${dbPath}`, `--cwd=${tmp}`, '--quiet']);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  test('migrate (explicit) --verbose prints applying message', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const dbPath = path.join(tmp, 'cli-verbose.db');
    const repoRoot = path.resolve(__dirname, '..');
    const migrationImport = path.join(repoRoot, 'src', 'migrations', 'Migration').replace(/\\/g, '/');
    const sqliteImport = path.join(repoRoot, 'src', 'providers', 'SQLiteProvider').replace(/\\/g, '/');
    fs.writeFileSync(
      path.join(tmp, 'tslinq.config.json'),
      JSON.stringify({ provider: 'sqlite', connectionString: dbPath, migrationsDir: 'migrations' }),
      'utf8'
    );
    const migDir = path.join(tmp, 'migrations');
    fs.mkdirSync(migDir);
    const indexTs = `
import { Migration } from '${migrationImport}';
import type { SQLiteProvider } from '${sqliteImport}';
export async function loadMigrations(provider: SQLiteProvider) {
  class M1 extends Migration { protected name='A'; protected version='001'; async up(){ await provider.executeNonQuery('CREATE TABLE z(id INTEGER PRIMARY KEY)'); } async down(){ await provider.executeNonQuery('DROP TABLE z'); } }
  return [new M1()];
}
`;
    fs.writeFileSync(path.join(migDir, 'index.ts'), indexTs, 'utf8');
    const r = runCli(['migrate', `--cwd=${tmp}`, '--verbose']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Applying 1 migration/);
  });
});


