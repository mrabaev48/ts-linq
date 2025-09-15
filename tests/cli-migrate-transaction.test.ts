import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('CLI migrate --transaction (diff mode)', () => {
  test('applies empty plan within a transaction without errors', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const cfg = {
      provider: 'sqlite',
      connectionString: path.join(tmp, 'db.sqlite'),
      migrationsDir: 'migrations',
      entitiesGlobs: []
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');

    const node = process.execPath;
    const cliPath = path.resolve(__dirname, '..', 'src', 'bin', 'ts-linq-cli.ts');
    const r = cp.spawnSync(
      node,
      ['-r', 'ts-node/register/transpile-only', cliPath, 'migrate', '--transaction', `--cwd=${tmp}`],
      { encoding: 'utf8', cwd: path.resolve(__dirname, '..') }
    );
    expect(r.status ?? 0).toBe(0);
    expect(r.stdout).toMatch(/Applied 0 step\(s\)\./);
  });
});
