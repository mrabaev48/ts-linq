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

describe('CLI exit codes', () => {
  test('unknown command returns 2', () => {
    const r = runCli(['__unknown__']);
    expect(r.code).toBe(2);
  });

  test('seed missing file returns 2', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const r = runCli(['seed', `--file=${path.join(tmp, 'nope.sql')}`]);
    expect(r.code).toBe(2);
  });
});
