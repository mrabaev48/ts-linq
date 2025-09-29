import type { DatabaseProvider } from '@ts-linq/core';
import { SchemaApplyCommand } from '../src/commands/SchemaApplyCommand';
import { ConsoleLogger } from '../src/adapters/ConsoleLogger';

class MemFs {
  private files = new Map<string, string>();
  public exists(p: string): boolean {
    return this.files.has(p);
  }
  public readText(p: string): string {
    const v = this.files.get(p) ?? '';
    return v;
  }
  public writeText(p: string, c: string): void {
    this.files.set(p, c);
  }
  public ensureDir(_d: string): void {}
  public readDir(_d: string): string[] {
    return [];
  }
}

class ProviderStub implements Partial<DatabaseProvider> {
  public providerLabel = 'sqlite' as const;
  public async executeNonQuery(_sql: string): Promise<number> {
    return 1;
  }
  public async executeQuery<T = unknown>(_sql: string, _params?: readonly unknown[]): Promise<T[]> {
    return [] as T[];
  }
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
}

describe('schema:apply negative', () => {
  it('sets exitCode=2 when snapshot file is missing', async () => {
    const file = '/tmp/not-exists.json';
    const fs = new MemFs();
    const logger = new ConsoleLogger();
    const cmd = new SchemaApplyCommand(logger as any, fs as any);
    await cmd.run(new ProviderStub() as unknown as DatabaseProvider, ['schema:apply', file]);
    expect(process.exitCode).toBe(2);
  });
});
