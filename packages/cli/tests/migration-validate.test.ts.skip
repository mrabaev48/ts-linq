import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MigrationsValidateCommand } from '../src/commands/MigrationsValidateCommand';

class SilentLogger {
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe.skip('migration:validate', () => {
  let tmpRoot: string;
  let migrationsDir: string;
  let cwdBackup: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-linq-validate-'));
    migrationsDir = path.join(tmpRoot, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
    cwdBackup = process.cwd();
    process.chdir(tmpRoot);
  });

  afterEach(() => {
    process.chdir(cwdBackup);
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  test('OK when filenames valid and classes implement up/down/getters', async () => {
    fs.writeFileSync(
      path.join(migrationsDir, '20250101000000_Init.js'),
      "class Init { get name(){return 'Init'} get version(){return '20250101000000'} getVersion(){return this.version} getName(){return this.name} async up(){} async down(){} }\nmodule.exports = { Init };\n"
    );
    const cmd = new MigrationsValidateCommand(new SilentLogger() as any);
    await cmd.run(['migration:validate']);
    expect(process.exitCode ?? 0).toBe(0);
    // reset exitCode for isolation
    process.exitCode = 0;
  });

  test('fails on invalid filename and missing methods', async () => {
    fs.writeFileSync(path.join(migrationsDir, 'badname.js'), 'module.exports = {};\n');
    const cmd = new MigrationsValidateCommand(new SilentLogger() as any);
    await cmd.run(['migration:validate']);
    expect((process.exitCode as number) > 0).toBe(true);
    process.exitCode = 0;
  });

  test('detects duplicate versions', async () => {
    fs.writeFileSync(
      path.join(migrationsDir, '20250101000000_A.js'),
      "class A { get name(){return 'A'} get version(){return '20250101000000'} getVersion(){return this.version} getName(){return this.name} async up(){} async down(){} }\nmodule.exports = { A };\n"
    );
    fs.writeFileSync(
      path.join(migrationsDir, '20250101000000_B.js'),
      "class B { get name(){return 'B'} get version(){return '20250101000000'} getVersion(){return this.version} getName(){return this.name} async up(){} async down(){} }\nmodule.exports = { B };\n"
    );
    const cmd = new MigrationsValidateCommand(new SilentLogger() as any);
    await cmd.run(['migration:validate']);
    expect((process.exitCode as number) > 0).toBe(true);
    process.exitCode = 0;
  });

  // Note: we don't check mismatch between version order and names,
  // since names start with version and sorting matches by definition.
});
