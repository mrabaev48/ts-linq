import type { DatabaseProvider } from '@ts-linq/core';
import { SchemaApplyCommand } from '../src/commands/SchemaApplyCommand';

jest.mock('@ts-linq/core', () => {
  return {
    SchemaSnapshotBuilder: class {
      // eslint-disable-next-line @typescript-eslint/require-await
      public async buildActualFromProvider(): Promise<unknown> {
        return {};
      }
      public buildExpectedFromMetadata(): unknown {
        return {};
      }
    },
    SchemaSnapshotSerializer: class {
      public deserialize(): unknown {
        return {};
      }
    },
    compareSchemas: () => ({}),
    generateMigrationFromDiff: () => ({ up: ['DROP TABLE Foo'] })
  };
});

class MemFs {
  public exists(): boolean {
    return true;
  }
  public readText(): string {
    return '{}';
  }
  public writeText(): void {}
  public ensureDir(): void {}
  public readDir(): string[] {
    return [];
  }
}

class ProviderStub implements Partial<DatabaseProvider> {
  public providerLabel = 'sqlite' as const;
  public async executeNonQuery(_sql: string): Promise<number> {
    return 1;
  }
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
}

describe.skip('schema:apply destructive guard', () => {
  it('requires --force for destructive SQL', async () => {
    process.exitCode = 0;
    const fs = new MemFs();
    const provider = new ProviderStub() as unknown as DatabaseProvider;
    const cmd = new SchemaApplyCommand(
      {
        info: () => {},
        warn: () => {},
        error: () => {}
      } as any,
      fs as any
    );

    await cmd.runDb(provider, ['schema:apply', '/tmp/schema.snapshot.json']);
    expect(process.exitCode).toBe(2);

    process.exitCode = 0;
    await cmd.runDb(provider, ['schema:apply', '/tmp/schema.snapshot.json', '--force']);
    expect(process.exitCode ?? 0).toBe(0);
  });
});
