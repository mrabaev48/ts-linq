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

describe('CLI migrate/rollback with explicit migrations', () => {
  test('migrate applies explicit migrations and rollback reverts to target', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const dbPath = path.join(tmp, 'cli-mig.db');
    const repoRoot = path.resolve(__dirname, '..');
    const migrationImport = path.join(repoRoot, 'src', 'migrations', 'Migration').replace(/\\/g, '/');
    const sqliteImport = path.join(repoRoot, 'src', 'providers', 'SQLiteProvider').replace(/\\/g, '/');

    // config
    const cfg = {
      provider: 'sqlite',
      connectionString: dbPath,
      migrationsDir: 'migrations'
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');

    // migrations/index.ts
    const migDir = path.join(tmp, 'migrations');
    fs.mkdirSync(migDir);
    const indexTs = `
import { Migration } from '${migrationImport}';
import type { SQLiteProvider } from '${sqliteImport}';

export async function loadMigrations(provider: SQLiteProvider) {
  class M1 extends Migration {
    protected name = 'CreateT';
    protected version = '001';
    public async up(): Promise<void> { await provider.executeNonQuery('CREATE TABLE t(id INTEGER PRIMARY KEY, v TEXT NOT NULL)'); }
    public async down(): Promise<void> { await provider.executeNonQuery('DROP TABLE t'); }
  }
  class M2 extends Migration {
    protected name = 'AddCol';
    protected version = '002';
    public async up(): Promise<void> { await provider.executeNonQuery('ALTER TABLE t ADD COLUMN n INTEGER'); }
    public async down(): Promise<void> {
      await provider.executeNonQuery('CREATE TABLE t_new(id INTEGER PRIMARY KEY, v TEXT NOT NULL)');
      await provider.executeNonQuery('INSERT INTO t_new(id, v) SELECT id, v FROM t');
      await provider.executeNonQuery('DROP TABLE t');
      await provider.executeNonQuery('ALTER TABLE t_new RENAME TO t');
    }
  }
  return [new M1(), new M2()];
}
`;
    fs.writeFileSync(path.join(migDir, 'index.ts'), indexTs, 'utf8');

    // migrate
    const r1 = runCli(['migrate', `--cwd=${tmp}`]);
    expect(r1.code).toBe(0);

    // status json
    const r2 = runCli(['status', '--json', `--cwd=${tmp}`]);
    expect(r2.code).toBe(0);
    const status = JSON.parse(r2.stdout);
    expect(Array.isArray(status.applied)).toBe(true);
    expect(status.applied.length).toBe(2);

    // rollback to 001
    const r3 = runCli(['rollback', '--to=001', `--cwd=${tmp}`]);
    expect(r3.code).toBe(0);
    const r4 = runCli(['status', '--json', `--cwd=${tmp}`]);
    const statusAfter = JSON.parse(r4.stdout);
    expect(statusAfter.applied.length).toBe(1);
    expect(statusAfter.applied[0].version).toBe('001');
  });
});


