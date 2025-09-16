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

describe('CLI verify with constraints', () => {
  test('diff --create then verify baseline ok', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const dbPath = path.join(tmp, 'cli-verify-constraints.db');
    const migDir = path.join(tmp, 'migrations');
    fs.mkdirSync(migDir);

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
class T {}
MetadataStorage.addEntity(T, 'T');
MetadataStorage.addColumn(T, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false });
MetadataStorage.addPrimaryKey(T, 'id');
MetadataStorage.addColumn(T, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false });
MetadataStorage.addIndex(T, { name: 'UQ_T_name', columns: ['name'], unique: true });
MetadataStorage.addCheck(T, { name: 'CK_name_len', expression: 'length(name) > 0' });
`;
    fs.writeFileSync(path.join(tmp, 'bootstrap.js'), bootstrapJs, 'utf8');

    // Create scaffold migration from diff
    const r1 = runCli(['diff', `--cwd=${tmp}`, '--create', '--name', 'InitConstraints']);
    expect(r1.code).toBe(0);
    // Create minimal migrations index so verify baseline works on file content
    fs.writeFileSync(path.join(migDir, 'index.ts'), 'export default [];', 'utf8');

    // Verify should create baseline
    const r2 = runCli(['verify', `--cwd=${tmp}`, '--json']);
    expect(r2.code).toBe(0);
    const j2 = JSON.parse(r2.stdout);
    expect(j2.ok).toBe(true);
    expect(j2.action).toBe('baseline_created');

    // Second run: ok true
    const r3 = runCli(['verify', `--cwd=${tmp}`, '--json']);
    expect(r3.code).toBe(0);
    const j3 = JSON.parse(r3.stdout);
    expect(j3.ok).toBe(true);
  });
});
