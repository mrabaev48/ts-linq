import type { DatabaseProvider } from '@ts-linq/core';
import { GenerateEntityCommand } from '../src/commands/GenerateEntityCommand';
import { GenerateEntitiesCommand } from '../src/commands/GenerateEntitiesCommand';
import { GenerateMigrationCommand } from '../src/commands/GenerateMigrationCommand';
import { ConsoleLogger } from '../src/adapters/ConsoleLogger';

class MemFs {
  public files = new Map<string, string>();
  private dirs = new Set<string>();
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
  public ensureDir(d: string): void {
    this.dirs.add(d);
  }
  public readDir(_d: string): string[] {
    return [];
  }
}

class ProviderStub implements Partial<DatabaseProvider> {
  public providerLabel = 'sqlite' as const;
  public async executeQuery<T = unknown>(_sql: string, _params?: readonly unknown[]): Promise<T[]> {
    return [] as T[];
  }
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
}

describe('generate commands', () => {
  it('generate:entity creates file', async () => {
    const fs = new MemFs();
    const cmd = new GenerateEntityCommand(new ConsoleLogger() as any, fs as any);
    // Команда ожидает имя в argv[2]
    await cmd.run(new ProviderStub() as unknown as DatabaseProvider, [
      'generate:entity',
      '(ignored)',
      'User',
      '--dir',
      '/tmp/entities'
    ]);
    const key = Array.from(fs.files.keys()).find((k) => k.endsWith('/tmp/entities/User.ts')) || '';
    const content = fs.readText(key);
    expect(content).toContain('export class User');
  });

  it('generate:entities handles empty tables gracefully', async () => {
    const fs = new MemFs();
    const cmd = new GenerateEntitiesCommand(new ConsoleLogger() as any, fs as any);
    await cmd.run(new ProviderStub() as unknown as DatabaseProvider, [
      'generate:entities',
      '--dir',
      '/tmp/entities'
    ]);
  });

  it('generate:migration emits template', async () => {
    const fs = new MemFs();
    const cmd = new GenerateMigrationCommand(new ConsoleLogger() as any, fs as any);
    await cmd.run(null, ['generate:migration', 'AddUsers']);
    const any = Array.from(fs.files.values());
    const found = any.some((c) => c.includes('export class AddUsers extends Migration'));
    expect(found).toBe(true);
  });
});
