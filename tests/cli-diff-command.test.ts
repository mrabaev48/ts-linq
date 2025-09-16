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

describe('CLI diff command', () => {
  test('diff --json prints steps for registered entity', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const dbPath = path.join(tmp, 'cli-diff.db');

    const cfg = {
      provider: 'sqlite',
      connectionString: dbPath,
      migrationsDir: 'migrations',
      bootstrap: ['bootstrap.js']
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');

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

    const r = runCli(['diff', `--cwd=${tmp}`, '--json']);
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(Array.isArray(out.steps)).toBe(true);
    expect(out.steps.join('\n')).toMatch(/CREATE TABLE IF NOT EXISTS DiffUser/);
  });

  test('diff --out writes SQL file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const dbPath = path.join(tmp, 'cli-diff.db');
    const outFile = path.join(tmp, 'plan.sql');

    const cfg = {
      provider: 'sqlite',
      connectionString: dbPath,
      migrationsDir: 'migrations',
      bootstrap: ['bootstrap.js']
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');

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

    const r = runCli(['diff', `--cwd=${tmp}`, `--out=${outFile}`]);
    expect(r.code).toBe(0);
    expect(fs.existsSync(outFile)).toBe(true);
    const sql = fs.readFileSync(outFile, 'utf8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS DiffUser/);
  });

  test('diff --create scaffolds migration file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const dbPath = path.join(tmp, 'cli-diff.db');

    const cfg = {
      provider: 'sqlite',
      connectionString: dbPath,
      migrationsDir: 'migrations',
      bootstrap: ['bootstrap.js']
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');

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

    const r = runCli(['diff', `--cwd=${tmp}`, '--create']);
    expect(r.code).toBe(0);
    const migDir = path.join(tmp, 'migrations');
    const files = fs.existsSync(migDir)
      ? fs.readdirSync(migDir).filter((f) => f.endsWith('_Diff.ts'))
      : [];
    expect(files.length).toBe(1);
    const content = fs.readFileSync(path.join(migDir, files[0]), 'utf8');
    expect(content).toMatch(/export class Diff_/);
    expect(content).toMatch(/CREATE TABLE IF NOT EXISTS DiffUser/);
  });

  test('diff --create --name=MyCustomName sets class and file name accordingly', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const dbPath = path.join(tmp, 'cli-diff.db');

    const cfg = {
      provider: 'sqlite',
      connectionString: dbPath,
      migrationsDir: 'migrations',
      bootstrap: ['bootstrap.js']
    };
    fs.writeFileSync(path.join(tmp, 'tslinq.config.json'), JSON.stringify(cfg), 'utf8');

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

    const r = runCli(['diff', `--cwd=${tmp}`, '--create', '--name=MyCustomName']);
    expect(r.code).toBe(0);
    const migDir = path.join(tmp, 'migrations');
    const files = fs.existsSync(migDir) ? fs.readdirSync(migDir) : [];
    const file = files.find((f) => /_MyCustomName\.ts$/.test(f));
    expect(file).toBeTruthy();
    const content = fs.readFileSync(path.join(migDir, file as string), 'utf8');
    expect(content).toContain('export class MyCustomName extends Migration');
    expect(content).toContain("protected get name() { return 'MyCustomName'; }");
  });
});
