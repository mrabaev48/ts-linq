import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';

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

describe('CLI migrate via diff with entitiesGlobs', () => {
  test('creates table for decorated entity (with bootstrap)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const dbPath = path.join(tmp, 'cli-diff.db');

    // config with entitiesGlobs
    const cfg = {
      provider: 'sqlite',
      connectionString: dbPath,
      migrationsDir: 'migrations',
      entitiesGlobs: [],
      bootstrap: ['bootstrap.js']
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');

    // bootstrap.ts: programmatically register an entity without decorators
    const metaCjs = path
      .join(__dirname, '..', 'dist', 'cjs', 'metadata', 'MetadataStorage.js')
      .replace(/\\/g, '/');
    const bootstrapJs = `
const { MetadataStorage } = require('${metaCjs}');
class DiffUser {}
MetadataStorage.addEntity(DiffUser, 'DiffUser');
MetadataStorage.addColumn(DiffUser, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, defaultValue: undefined, isGenerated: true, length: undefined, precision: undefined, scale: undefined, isVersion: false });
MetadataStorage.addPrimaryKey(DiffUser, 'id');
MetadataStorage.addColumn(DiffUser, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false, defaultValue: undefined, isGenerated: false, length: undefined, precision: undefined, scale: undefined, isVersion: false });
`;
    fs.writeFileSync(path.join(tmp, 'bootstrap.js'), bootstrapJs, 'utf8');

    const r1 = runCli(['migrate', `--cwd=${tmp}`, '--dry-run', '--json']);
    if (r1.code !== 0) {
      // eslint-disable-next-line no-console
      console.error('CLI failed. stdout:', r1.stdout);
      // eslint-disable-next-line no-console
      console.error('CLI failed. stderr:', r1.stderr);
    }
    expect(r1.code).toBe(0);
    const out = JSON.parse(r1.stdout);
    expect(Array.isArray(out.steps)).toBe(true);
    // Helpful diagnostics
    if (!out.steps || out.steps.length === 0) {
      // eslint-disable-next-line no-console
      console.error('CLI stdout:', r1.stdout);
      // eslint-disable-next-line no-console
      console.error('CLI stderr:', r1.stderr);
    }
    expect(out.steps.join('\n')).toMatch(/CREATE TABLE IF NOT EXISTS DiffUser/);
  });
});


