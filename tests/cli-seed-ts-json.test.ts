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

describe('CLI seed TS JSON output', () => {
  test('prints JSON for TS script (dry-run)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const seedsDir = path.join(tmp, 'seeds');
    fs.mkdirSync(seedsDir);
    const dbPath = path.join(tmp, 'cli-seed.db');
    const ts = `export async function run(){}`;
    const file = path.join(seedsDir, 'seeds.ts');
    fs.writeFileSync(file, ts, 'utf8');
    const r = runCli(['seed', `--provider=sqlite`, `--conn=${dbPath}`, `--cwd=${tmp}`, file, '--dry-run', '--json']);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.ok).toBe(true);
    expect(j.script).toBe(true);
  });

  test('prints JSON for TS script (execute)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const seedsDir = path.join(tmp, 'seeds');
    fs.mkdirSync(seedsDir);
    const dbPath = path.join(tmp, 'cli-seed.db');
    const ts = `export async function run(provider:any){ await provider.executeNonQuery('CREATE TABLE IF NOT EXISTS t(y INTEGER)'); }`;
    const file = path.join(seedsDir, 'seeds.ts');
    fs.writeFileSync(file, ts, 'utf8');
    const r = runCli(['seed', `--provider=sqlite`, `--conn=${dbPath}`, `--cwd=${tmp}`, file, '--json', '--yes']);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.ok).toBe(true);
    expect(j.script).toBe(true);
  });
});
