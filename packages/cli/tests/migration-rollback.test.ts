import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MigrationsRollbackCommand } from '../src/commands/MigrationsRollbackCommand';
import { MigrationRunner } from '@ts-linq/migrations';

class FakeProvider {
  public providerLabel = 'postgresql';
  public applied: Array<{ version: string; name: string; applied_at: string }> = [];
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async beginTransaction(): Promise<void> {}
  async commitTransaction(): Promise<void> {}
  async rollbackTransaction(): Promise<void> {}
  async executeNonQuery(_sql: string, _params?: unknown[]): Promise<number> {
    return 1;
  }
  async executeQuery<T = unknown>(_sql: string): Promise<T[]> {
    return this.applied as unknown as T[];
  }
}

describe('migration:rollback', () => {
  let tmpRoot: string;
  let migrationsDir: string;
  let cwdBackup: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-linq-rollback-'));
    migrationsDir = path.join(tmpRoot, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
    // two migrations on disk
    fs.writeFileSync(
      path.join(migrationsDir, '20250101000000_Init.js'),
      "class Init { get name(){return 'Init'} get version(){return '20250101000000'} getVersion(){return this.version} getName(){return this.name} async up(){} async down(){} }\nmodule.exports = { Init };\n"
    );
    fs.writeFileSync(
      path.join(migrationsDir, '20250102000000_AddUsers.js'),
      "class AddUsers { get name(){return 'AddUsers'} get version(){return '20250102000000'} getVersion(){return this.version} getName(){return this.name} async up(){} async down(){} }\nmodule.exports = { AddUsers };\n"
    );
    cwdBackup = process.cwd();
    process.chdir(tmpRoot);
  });

  afterEach(() => {
    process.chdir(cwdBackup);
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  test('--steps computes target version from applied list', async () => {
    const provider = new FakeProvider();
    provider.applied = [
      { version: '20250101000000', name: 'Init', applied_at: new Date().toISOString() },
      { version: '20250102000000', name: 'AddUsers', applied_at: new Date().toISOString() },
      { version: '20250103000000', name: 'AddPosts', applied_at: new Date().toISOString() }
    ];

    const spy = jest
      .spyOn(
        MigrationRunner.prototype as unknown as { rollback: (v?: string) => Promise<void> },
        'rollback'
      )
      .mockImplementation(async () => {});
    const cmd = new MigrationsRollbackCommand(
      { info() {}, warn() {}, error() {} } as any,
      {
        exists: (p: string) => fs.existsSync(p),
        readText: (p: string) => fs.readFileSync(p, 'utf8'),
        writeText: (p: string, d: string) => fs.writeFileSync(p, d),
        ensureDir: (p: string) => fs.mkdirSync(p, { recursive: true }),
        readDir: (p: string) => fs.readdirSync(p)
      } as any
    );

    await cmd.runDb(provider as any, ['migration:rollback', '--steps=1']);
    expect(spy).toHaveBeenCalledWith('20250102000000');
    spy.mockRestore();
  });

  test('--to passes target version through', async () => {
    const provider = new FakeProvider();
    provider.applied = [
      { version: '20250101000000', name: 'Init', applied_at: new Date().toISOString() }
    ];
    const spy = jest
      .spyOn(
        MigrationRunner.prototype as unknown as { rollback: (v?: string) => Promise<void> },
        'rollback'
      )
      .mockImplementation(async () => {});
    const cmd = new MigrationsRollbackCommand();
    await cmd.runDb(provider as any, ['migration:rollback', '--to=20240101010101']);
    expect(spy).toHaveBeenCalledWith('20240101010101');
    spy.mockRestore();
  });
});
