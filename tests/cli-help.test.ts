import * as cp from 'child_process';
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

describe('CLI help', () => {
  it('prints help with details flag and examples', () => {
    const r = runCli(['help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/ts-linq CLI/);
    expect(r.stdout).toMatch(/--details/);
    expect(r.stdout).toMatch(/Examples:/);
    expect(r.stdout).toMatch(/generate entity/);
  });
});


