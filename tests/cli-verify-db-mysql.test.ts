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

const HAS_MY = !!process.env.MYSQL_URL;

(HAS_MY ? describe : describe.skip)('CLI verify --db (MySQL)', () => {
  test('stores checksums and returns ok', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const cfg = {
      provider: 'mysql',
      connectionString: process.env.MYSQL_URL,
      migrationsDir: 'migrations',
      seedsDir: 'seeds',
      entitiesGlobs: []
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');
    const migDir = path.join(tmp, 'migrations');
    fs.mkdirSync(migDir);
    fs.writeFileSync(path.join(migDir, 'index.ts'), 'export default [] as any[];', 'utf8');
    const r1 = runCli(['verify', `--cwd=${tmp}`, '--json', '--db']);
    expect(r1.code).toBe(0);
    const r2 = runCli(['verify', `--cwd=${tmp}`, '--json', '--db']);
    expect(r2.code).toBe(0);
  });
});


