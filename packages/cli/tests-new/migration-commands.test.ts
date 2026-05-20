import { DatabaseProvider } from '@ts-linq/core';
import type { SqlDialect } from '@ts-linq/types';

import { GenerateMigrationCommand } from '../src/commands/GenerateMigrationCommand';
import { MigrationsDryRunCommand } from '../src/commands/MigrationsDryRunCommand';
import { MigrationsRollbackCommand } from '../src/commands/MigrationsRollbackCommand';
import { MigrationsStatusCommand } from '../src/commands/MigrationsStatusCommand';
import type { FileSystem } from '../src/ports/FileSystem';
import type { Logger } from '../src/ports/Logger';

type AppliedMigration = { version: string; name: string };

class InMemoryLogger implements Logger {
  public readonly infos: string[] = [];
  public readonly warns: string[] = [];
  public readonly errors: string[] = [];
  info(message: string): void {
    this.infos.push(message);
  }
  warn(message: string): void {
    this.warns.push(message);
  }
  error(message: string): void {
    this.errors.push(message);
  }
}

class InMemoryFs implements FileSystem {
  private readonly files = new Map<string, string>();
  private readonly directories = new Set<string>();
  exists(path: string): boolean {
    return this.files.has(path) || this.directories.has(path);
  }
  readText(path: string): string {
    const found = this.files.get(path);
    if (found === undefined) throw new Error(`File not found: ${path}`);
    return found;
  }
  writeText(path: string, contents: string): void {
    this.files.set(path, contents);
  }
  ensureDir(path: string): void {
    this.directories.add(path);
  }
  readDir(path: string): string[] {
    const prefix = path.endsWith('/') ? path : `${path}/`;
    const names = new Set<string>();
    // @ts-ignore
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        const name = rest.split('/')[0];
        names.add(name);
      }
    }
    return Array.from(names.values());
  }
}

describe('CLI - Migration Commands (tests-new)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    // reset exit code between tests
    process.exitCode = undefined;
  });

  test('GenerateMigrationCommand creates timestamped migration file and logs path', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    // Freeze time for deterministic timestamp: 2025-11-19T12:34:56Z -> 20251119123456
    jest.setSystemTime(new Date('2025-11-19T12:34:56Z'));

    const templateText = '// migration template';
    const builder = {
      build: (name: string, ts: string): string => `${ts}:${name}\n${templateText}`
    };
    const cmd = new GenerateMigrationCommand(logger, fs, builder);

    await cmd.run(['generate:migration', 'UserCreate']);

    const createdInfo = logger.infos.find((x) => x.startsWith('Created '));
    if (!createdInfo) {
      throw new Error('Expected Created <path> log, but it was not found');
    }
    // Expect a file under migrations/<timestamp>_UserCreate.ts
    const filePath = createdInfo.replace('Created ', '');
    expect(filePath).toMatch(/migrations\/20251119123456_UserCreate\.ts$/);
  });
});

// Module-level mocks for @ts-linq/migrations usages
jest.mock('@ts-linq/migrations', () => {
  const applied: AppliedMigration[] = [];
  const getAppliedMigrations = jest.fn().mockResolvedValue(applied);
  const rollback = jest.fn().mockResolvedValue(undefined);
  class MigrationRunner {
    public constructor(_provider: unknown) {}
    public getAppliedMigrations = getAppliedMigrations;
    public rollback = rollback;
    // Test utilities to control/inspect behavior
    public static __setApplied(list: AppliedMigration[]): void {
      applied.length = 0;
      for (const a of list) applied.push(a);
    }
    public static __getMocks(): {
      getAppliedMigrations: typeof getAppliedMigrations;
      rollback: typeof rollback;
    } {
      return { getAppliedMigrations, rollback };
    }
  }

  const SchemaSnapshotBuilder = class {
    public constructor(_provider?: unknown) {}

    public buildActualFromProvider(_target: unknown): Promise<unknown> {
      return Promise.resolve({}); // dummy
    }
    public buildExpectedFromMetadata(): unknown {
      return {};
    }
  };
  const SchemaSnapshotSerializer = class {
    public serialize(_snapshot: unknown): string {
      return '{"snapshot":true}';
    }
    public deserialize(text: string): unknown {
      return JSON.parse(text) as unknown;
    }
  };
  const compareSchemas = jest.fn().mockReturnValue({ diff: 1 });
  const generateMigrationFromDiff = jest
    .fn()
    .mockReturnValue({ up: ['CREATE TABLE X;'], down: [] });

  return {
    MigrationRunner,
    SchemaSnapshotBuilder,
    SchemaSnapshotSerializer,
    compareSchemas,
    generateMigrationFromDiff
  };
});

describe('CLI - Migration Status / Rollback / Dry-Run (tests-new)', () => {
  // Minimal provider to satisfy type requirements
  class MinimalProvider extends DatabaseProvider {
    constructor() {
      super('mock://');
      (this as unknown as { providerName: string }).providerName = 'test';
    }
    async connect() {}
    async disconnect() {}
    async createTable() {}
    getDialect(): SqlDialect {
      return {
        buildSelect: () => ({ query: '', parameters: [] }),
        quoteIdentifier: (s: string) => s
      };
    }
    async insert<T extends object>(entity: T, _entityClass: Function): Promise<T> {
      return entity;
    }
    async update<T extends object>(entity: T, _entityClass: Function): Promise<T> {
      return entity;
    }
    async delete() {}
    async findById<T extends object>(_id: unknown, _entityClass: new () => T): Promise<T | null> {
      return null;
    }
    async findAll<T extends object>(_entityClass: new () => T): Promise<T[]> {
      return [];
    }
    async findWhere<T extends object>(
      _entityClass: new () => T,
      _c: Record<string, unknown>
    ): Promise<T[]> {
      return [];
    }
    async findWhereIn<T extends object>(
      _e: new () => T,
      _col: string,
      _v: unknown[]
    ): Promise<T[]> {
      return [];
    }
    protected async doExecuteQuery<T>(): Promise<T[]> {
      return [];
    }
    protected async doExecuteNonQuery(): Promise<number> {
      return 0;
    }
    public override async beginTransaction(): Promise<void> {}
    public override async commitTransaction(): Promise<void> {}
    public override async rollbackTransaction(): Promise<void> {}
    protected override async doConnect(): Promise<void> {}
    protected override async doDisconnect(): Promise<void> {}
    protected override async doBeginTransaction(): Promise<void> {}
    protected override async doCommitTransaction(): Promise<void> {}
    protected override async doRollbackTransaction(): Promise<void> {}
  }
  const provider: DatabaseProvider = new MinimalProvider();

  test('MigrationsStatusCommand prints applied and pending migrations', async () => {
    const { MigrationRunner } = jest.requireMock('@ts-linq/migrations');
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();

    // Prepare migrations dir files
    fs.ensureDir(`${process.cwd()}/migrations`);
    fs.writeText(`${process.cwd()}/migrations/20250101000000_Init.ts`, '//');
    fs.writeText(`${process.cwd()}/migrations/20250102000000_AddUser.ts`, '//');

    // Applied only the first one
    MigrationRunner.__setApplied([{ version: '20250101000000', name: 'Init' }]);

    const cmd = new MigrationsStatusCommand(logger, fs);
    await cmd.runDb(provider, []);

    expect(logger.infos).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Migrations directory:/),
        'Applied: 1',
        '  20250101000000  Init',
        'Pending: 1',
        '  20250102000000  AddUser'
      ])
    );
  });

  test('MigrationsRollbackCommand rolls back to specific version via --to', async () => {
    const mocked = jest.requireMock('@ts-linq/migrations');
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    mocked.MigrationRunner.__setApplied([
      { version: '20250101000000', name: 'Init' },
      { version: '20250102000000', name: 'AddUser' }
    ]);
    const { rollback } = mocked.MigrationRunner.__getMocks();
    rollback.mockClear();

    const cmd = new MigrationsRollbackCommand(logger, fs);
    await cmd.runDb(provider, ['--to=20250101000000']);

    expect(rollback).toHaveBeenCalledWith('20250101000000');
    expect(logger.infos).toEqual(
      expect.arrayContaining(['Rolling back to version 20250101000000...'])
    );
  });

  test('MigrationsRollbackCommand rolls back N steps via --steps', async () => {
    const mocked = jest.requireMock('@ts-linq/migrations');
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    mocked.MigrationRunner.__setApplied([
      { version: '20250101000000', name: 'Init' },
      { version: '20250102000000', name: 'AddUser' },
      { version: '20250103000000', name: 'More' }
    ]);
    const { rollback } = mocked.MigrationRunner.__getMocks();
    rollback.mockClear();

    const cmd = new MigrationsRollbackCommand(logger, fs);
    await cmd.runDb(provider, ['--steps=2']);

    // KeepCount = applied.length - steps = 1 -> target is version at index keepCount-1 = 0
    expect(rollback).toHaveBeenCalledWith('20250101000000');
    expect(logger.infos.some((x) => x.includes('Rolling back'))).toBe(true);
  });

  test('MigrationsDryRunCommand prints SQL for diff and sets exit code on missing snapshot', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();

    // Missing snapshot: should set process.exitCode and not throw
    await new MigrationsDryRunCommand(logger, fs).runDb(provider, ['/missing.json']);
    expect(process.exitCode).toBe(2);
    expect(logger.errors).toHaveLength(1);

    // Provide snapshot and expect SQL printed
    process.exitCode = undefined;
    const snapshotPath = `${process.cwd()}/schema.snapshot.json`;
    fs.writeText(snapshotPath, JSON.stringify({ snapshot: true }));
    await new MigrationsDryRunCommand(logger, fs).runDb(provider, [snapshotPath]);

    expect(logger.infos).toEqual(expect.arrayContaining(['CREATE TABLE X;']));
  });
});
