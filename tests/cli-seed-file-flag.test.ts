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

describe('CLI seed --file flag', () => {
  test('applies SQL from explicit --file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const sqlFile = path.join(tmp, 'custom.sql');
    fs.writeFileSync(sqlFile, 'CREATE TABLE IF NOT EXISTS z(a INTEGER);', 'utf8');
    const dbPath = path.join(tmp, 'cli-seed.db');
    const r = runCli(['seed', `--provider=sqlite`, `--conn=${dbPath}`, `--cwd=${tmp}`, `--file=${sqlFile}`, '--yes']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Applied 1 seed statements/);
  });
});


