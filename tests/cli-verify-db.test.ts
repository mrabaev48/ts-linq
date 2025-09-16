import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function runCli(args: string[]) {
  const node = process.execPath;
  const cliPath = path.resolve(__dirname, '..', 'src', 'bin', 'ts-linq-cli.ts');
  const result = cp.spawnSync(node, ['-r', 'ts-node/register/transpile-only', cliPath, ...args], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env },
    encoding: 'utf8'
  });
  return { code: result.status ?? 0, stdout: result.stdout, stderr: result.stderr };
}

describe('CLI verify --db', () => {
  test('stores checksums and returns ok on subsequent run', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const cfg = {
      provider: 'sqlite',
      connectionString: path.join(tmp, 'db.sqlite'),
      migrationsDir: 'migrations',
      seedsDir: 'seeds',
      entitiesGlobs: []
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');
    const migDir = path.join(tmp, 'migrations');
    fs.mkdirSync(migDir);
    fs.writeFileSync(path.join(migDir, 'index.ts'), 'export default [] as any[];', 'utf8');
    let r = runCli(['verify', `--cwd=${tmp}`, '--json', '--db']);
    expect(r.code).toBe(0);
    const first = JSON.parse(r.stdout);
    expect(first.ok).toBe(true);
    r = runCli(['verify', `--cwd=${tmp}`, '--json', '--db']);
    const second = JSON.parse(r.stdout);
    expect(second.ok).toBe(true);
  });
});
