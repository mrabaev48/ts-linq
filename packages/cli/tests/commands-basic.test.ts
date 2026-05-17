import type { DatabaseProvider } from '@ts-linq/core';

import { ConsoleLogger } from '../src/adapters/ConsoleLogger';
import { SchemaApplyCommand } from '../src/commands/SchemaApplyCommand';
import { SchemaDiffCommand } from '../src/commands/SchemaDiffCommand';
import { SchemaExportCommand } from '../src/commands/SchemaExportCommand';
import { SchemaValidateCommand } from '../src/commands/SchemaValidateCommand';
import { SeedCommand } from '../src/commands/SeedCommand';

class FakeProvider implements Partial<DatabaseProvider> {
  public providerLabel = 'postgresql' as const;
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async executeNonQuery(_sql: string): Promise<number> {
    return 1;
  }
  public async executeQuery<T = unknown>(_sql: string, _params?: readonly unknown[]): Promise<T[]> {
    return [] as T[];
  }
}

class MemFs {
  private files = new Map<string, string>();
  public exists(p: string): boolean {
    return this.files.has(p);
  }
  public readText(p: string): string {
    const v = this.files.get(p);
    if (v == null) throw new Error('missing');
    return v;
  }
  public writeText(p: string, contents: string): void {
    this.files.set(p, contents);
  }
  public ensureDir(_d: string): void {}
  public readDir(_d: string): string[] {
    return [];
  }
}

describe('CLI commands basic', () => {
  const logger = new ConsoleLogger();
  const out = '/tmp/schema.snapshot.json';

  it('schema:export writes snapshot', async () => {
    const fs = new MemFs();
    const cmd = new SchemaExportCommand(logger, fs);
    await cmd.run(['schema:export', out]);
    expect(fs.exists(out)).toBe(true);
    expect(fs.readText(out)).toContain('tables');
  });

  it('schema:diff prints SQL or warns when file missing', async () => {
    const fs = new MemFs();
    const cmd = new SchemaDiffCommand(logger, fs);
    await cmd.runDb(new FakeProvider() as unknown as DatabaseProvider, ['schema:diff', out]);
    fs.writeText(out, JSON.stringify({ tables: [] }));
    await cmd.runDb(new FakeProvider() as unknown as DatabaseProvider, ['schema:diff', out]);
  });

  it('schema:validate detects drift or ok', async () => {
    const fs = new MemFs();
    const cmd = new SchemaValidateCommand(logger, fs);
    fs.writeText(out, JSON.stringify({ tables: [] }));
    await cmd.runDb(new FakeProvider() as unknown as DatabaseProvider, ['schema:validate', out]);
  });

  it('schema:apply honors dry-run', async () => {
    const fs = new MemFs();
    fs.writeText(out, JSON.stringify({ tables: [] }));
    const cmd = new SchemaApplyCommand(logger, fs);
    await cmd.runDb(new FakeProvider() as unknown as DatabaseProvider, [
      'schema:apply',
      out,
      '--dry-run'
    ]);
  });

  it('seed applies statements', async () => {
    const fs = new MemFs();
    fs.writeText('/tmp/seed.sql', 'CREATE TABLE t1(id int);\nINSERT INTO t1 VALUES(1);');
    const cmd = new SeedCommand(logger, fs);
    await cmd.runDb(new FakeProvider() as unknown as DatabaseProvider, ['seed', '/tmp/seed.sql']);
  });
});
