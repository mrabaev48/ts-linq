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

describe('CLI diff/verify MySQL e2e (conditional)', () => {
  const url = process.env.MYSQL_URL;
  if (!url) {
    test.skip('skipped: MYSQL_URL not set', () => {});
    return;
  }

  test('diff --json --details includes UNIQUE for MySQL', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const cfg = {
      provider: 'mysql',
      connectionString: url,
      migrationsDir: 'migrations',
      bootstrap: ['bootstrap.js']
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');
    const metaSrc = path
      .join(__dirname, '..', 'src', 'metadata', 'MetadataStorage.ts')
      .replace(/\\/g, '/');
    const bootstrapJs = `
const { MetadataStorage } = require('${metaSrc}');
class T {}
MetadataStorage.addEntity(T, 'T_cli_my');
MetadataStorage.addColumn(T, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false });
MetadataStorage.addPrimaryKey(T, 'id');
MetadataStorage.addColumn(T, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false });
MetadataStorage.addIndex(T, { name: 'UQ_T_cli_my_name', columns: ['name'], unique: true });
`;
    fs.writeFileSync(path.join(tmp, 'bootstrap.js'), bootstrapJs, 'utf8');
    const r = runCli(['diff', `--cwd=${tmp}`, '--json', '--details']);
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(Array.isArray(out.steps)).toBe(true);
  });
});
