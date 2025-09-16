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

describe('CLI init', () => {
  test('creates config and directories', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const r = runCli(['init', `--cwd=${tmp}`]);
    expect(r.code).toBe(0);
    expect(fs.existsSync(path.join(tmp, 'tslinq.config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'migrations'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'seeds'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'seeds', 'seeds.sql'))).toBe(true);
  });
});
