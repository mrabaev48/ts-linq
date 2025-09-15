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

describe('CLI diff --details', () => {
  test('diff --json --details prints steps and details snapshot/diff', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const dbPath = path.join(tmp, 'cli-diff.db');

    const cfg = {
      provider: 'sqlite',
      connectionString: dbPath,
      migrationsDir: 'migrations',
      bootstrap: ['bootstrap.js']
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');

    const metaSrc = path
      .join(__dirname, '..', 'src', 'metadata', 'MetadataStorage.ts')
      .replace(/\\/g, '/');
    const bootstrapJs = `
const { MetadataStorage } = require('${metaSrc}');
class DiffUser {}
MetadataStorage.addEntity(DiffUser, 'DiffUser');
MetadataStorage.addColumn(DiffUser, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, defaultValue: undefined, isGenerated: true, length: undefined, precision: undefined, scale: undefined, isVersion: false });
MetadataStorage.addPrimaryKey(DiffUser, 'id');
MetadataStorage.addColumn(DiffUser, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false, defaultValue: undefined, isGenerated: false, length: undefined, precision: undefined, scale: undefined, isVersion: false });
// add unique and check
MetadataStorage.addIndex(DiffUser, { name: 'UQ_DiffUser_name', columns: ['name'], unique: true });
MetadataStorage.addCheck(DiffUser, { name: 'CK_name_len', expression: 'length(name) > 0' });
`;
    fs.writeFileSync(path.join(tmp, 'bootstrap.js'), bootstrapJs, 'utf8');

    const r = runCli(['diff', `--cwd=${tmp}`, '--json', '--details']);
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(Array.isArray(out.steps)).toBe(true);
    // Ensure steps include UNIQUE or CHECK related entries
    const stepsStr = out.steps.join('\n');
    expect(stepsStr).toMatch(/UNIQUE|CHECK|CREATE UNIQUE INDEX/);
    expect(out).toHaveProperty('details');
    expect(out.details).toHaveProperty('expected');
    expect(Array.isArray(out.details.expected.tables)).toBe(true);
    expect(out.details.expected.tables.length).toBeGreaterThan(0);
    expect(out.details).toHaveProperty('actual');
    expect(Array.isArray(out.details.actual.tables)).toBe(true);
    expect(out.details).toHaveProperty('diff');
    expect(Array.isArray(out.details.diff.tables)).toBe(true);
  });
});


