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

describe('CLI verify command', () => {
  test('creates baseline in dry-run and then actually creates it', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const dbPath = path.join(tmp, 'cli-verify.db');
    const migDir = path.join(tmp, 'migrations');
    fs.mkdirSync(migDir);

    const cfg = {
      provider: 'sqlite',
      connectionString: dbPath,
      migrationsDir: 'migrations'
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');

    // minimal migrations index
    const indexTs = `export default [];`;
    fs.writeFileSync(path.join(migDir, 'index.ts'), indexTs, 'utf8');

    const r1 = runCli(['verify', '--json', '--dry-run', `--cwd=${tmp}`]);
    expect(r1.code).toBe(0);
    const j1 = JSON.parse(r1.stdout);
    expect(j1.ok).toBe(true);
    expect(j1.action).toBe('would_create_baseline');

    const r2 = runCli(['verify', '--json', `--cwd=${tmp}`]);
    expect(r2.code).toBe(0);
    const j2 = JSON.parse(r2.stdout);
    expect(j2.ok).toBe(true);
    const baselineFile = path.join(migDir, '.tslinq.checksum');
    expect(fs.existsSync(baselineFile)).toBe(true);
  });

  test('detects checksum mismatch with exit code 3', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const dbPath = path.join(tmp, 'cli-verify.db');
    const migDir = path.join(tmp, 'migrations');
    fs.mkdirSync(migDir);

    const cfg = {
      provider: 'sqlite',
      connectionString: dbPath,
      migrationsDir: 'migrations'
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');

    const idx = path.join(migDir, 'index.ts');
    fs.writeFileSync(idx, 'export default [];', 'utf8');
    // Create baseline
    const r0 = runCli(['verify', `--cwd=${tmp}`]);
    expect(r0.code).toBe(0);

    // Change file → checksum changes
    fs.writeFileSync(idx, 'export default [1];', 'utf8');
    const r = runCli(['verify', '--json', `--cwd=${tmp}`]);
    expect(r.code).toBe(3);
    const j = JSON.parse(r.stdout);
    expect(j.ok).toBe(false);
    expect(typeof j.stored).toBe('string');
    expect(typeof j.current).toBe('string');
    expect(j.stored).not.toBe(j.current);
  });
});


