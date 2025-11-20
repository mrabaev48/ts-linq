import type { Logger } from '../src/ports/Logger';
import type { FileSystem } from '../src/ports/FileSystem';
import { SchemaExportCommand } from '../src/commands/SchemaExportCommand';
import { SchemaApplyCommand } from '../src/commands/SchemaApplyCommand';
import { SeedCommand } from '../src/commands/SeedCommand';
import { DatabaseProvider } from '@ts-linq/core';
import type { SqlDialect } from '@ts-linq/types';

jest.mock('../src/utils', () => {
  return {
    getFlag: (argv: string[], name: string): boolean =>
      argv.some((a) => a === `--${name}` || a.startsWith(`--${name}=`)),
    resolveDialect: (label: string) => label
  };
});

jest.mock('@ts-linq/migrations', () => {
  class SchemaSnapshotBuilder {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public constructor(_provider?: unknown) {}
    public buildExpectedFromMetadata(): unknown {
      return { meta: true };
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async buildActualFromProvider(_target: unknown): Promise<unknown> {
      return { actual: true };
    }
  }
  class SchemaSnapshotSerializer {
    public serialize(snapshot: unknown): string {
      return JSON.stringify(snapshot);
    }
    public deserialize(text: string): unknown {
      return JSON.parse(text) as unknown;
    }
  }
  const compareSchemas = jest.fn().mockReturnValue({ diff: 1 });
  let upSql: string[] = ['CREATE TABLE T;'];
  const generateMigrationFromDiff = jest.fn().mockImplementation(() => ({ up: upSql, down: [] }));
  // allow tests to swap SQL rendered
  (generateMigrationFromDiff as unknown as { __setUpSql: (s: string[]) => void }).__setUpSql = (
    sql: string[]
  ) => {
    upSql = sql;
  };
  return {
    SchemaSnapshotBuilder,
    SchemaSnapshotSerializer,
    compareSchemas,
    generateMigrationFromDiff
  };
});

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
  readDir(_path: string): string[] {
    return [];
  }
}

describe('CLI - DB Commands (tests-new)', () => {
  class MinimalProvider extends DatabaseProvider {
    public executeNonQuery = jest.fn(async (_sql: string) => 0);
    constructor() {
      super('mock://');
      (this as unknown as { providerName: string }).providerName = 'sqlite';
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
    async insert<T extends object>(entity: T, _entityClass: Function): Promise<T> { return entity; }
    async update<T extends object>(entity: T, _entityClass: Function): Promise<T> { return entity; }
    async delete() {}
    async findById<T extends object>(_id: unknown, _entityClass: new () => T): Promise<T | null> { return null; }
    async findAll<T extends object>(_entityClass: new () => T): Promise<T[]> { return [] as unknown as T[]; }
    async findWhere<T extends object>(_entityClass: new () => T, _conditions: Record<string, unknown>): Promise<T[]> { return [] as unknown as T[]; }
    async findWhereIn<T extends object>(_entityClass: new () => T, _column: string, _values: unknown[]): Promise<T[]> { return [] as unknown as T[]; }
    protected async doExecuteQuery<T>(_sql: string, _params?: readonly unknown[]): Promise<T[]> { return [] as unknown as T[]; }
    protected async doExecuteNonQuery(_sql: string, _params?: readonly unknown[]): Promise<number> { return 0; }
    async beginTransaction() {}
    async commitTransaction() {}
    async rollbackTransaction() {}
  }
  const provider = new MinimalProvider() as unknown as import('@ts-linq/core').DatabaseProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = undefined;
  });

  test('SchemaExportCommand writes snapshot to file and logs path', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    const cmd = new SchemaExportCommand(logger, fs);
    await cmd.run(['schema:export', 'schema.snapshot.json']);

    expect(logger.infos).toEqual(
      expect.arrayContaining(['Schema snapshot saved to schema.snapshot.json'])
    );
    expect(fs.exists('schema.snapshot.json')).toBe(true);
  });

  test('SchemaApplyCommand sets exit code when snapshot missing', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    const cmd = new SchemaApplyCommand(logger, fs);
    await cmd.runDb(provider, ['schema.snapshot.json']);
    expect(process.exitCode).toBe(2);
    expect(logger.errors).toHaveLength(1);
  });

  test('SchemaApplyCommand dry-run prints SQL from diff', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    const cmd = new SchemaApplyCommand(logger, fs);
    const abs = `${process.cwd()}/schema.snapshot.json`;
    fs.writeText(abs, JSON.stringify({}));
    await cmd.runDb(provider, [abs, '--dry-run']);
    expect(provider.executeNonQuery).not.toHaveBeenCalled();
  });

  test('SchemaApplyCommand warns and exits on destructive SQL without --force', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    const cmd = new SchemaApplyCommand(logger, fs);
    const abs = `${process.cwd()}/schema.snapshot.json`;
    fs.writeText(abs, JSON.stringify({}));
    const mocked = jest.requireMock('@ts-linq/migrations');
    mocked.generateMigrationFromDiff.__setUpSql(['DROP TABLE Users;']);

    await cmd.runDb(provider, [abs]);

    expect(logger.warns).toEqual(
      expect.arrayContaining([
        'Destructive change detected (DROP/DELETE). Re-run with --force to apply.'
      ])
    );
    expect(process.exitCode).toBe(2);
    expect(provider.executeNonQuery).not.toHaveBeenCalled();
  });

  test('SchemaApplyCommand applies non-destructive SQL and logs applied steps', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    const cmd = new SchemaApplyCommand(logger, fs);
    const abs = `${process.cwd()}/schema.snapshot.json`;
    fs.writeText(abs, JSON.stringify({}));
    const mocked = jest.requireMock('@ts-linq/migrations');
    mocked.generateMigrationFromDiff.__setUpSql([
      '-- comment',
      'CREATE TABLE A;',
      'INSERT INTO A VALUES (1);'
    ]);

    await cmd.runDb(provider, [abs]);

    expect(logger.infos).toEqual(expect.arrayContaining(['Applied 2 step(s) from snapshot']));
  });

  test('SeedCommand executes SQL statements from file and logs result', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    const cmd = new SeedCommand(logger, fs);

    await cmd.runDb(provider, ['/missing.sql']);
    expect(process.exitCode).toBe(2);
    expect(logger.errors).toHaveLength(1);

    process.exitCode = undefined;
    const absSeed = `${process.cwd()}/seeds.sql`;
    fs.writeText(absSeed, 'INSERT INTO A VALUES (1);  \nINSERT INTO B VALUES (2);  ');
    // also write relative variant to match argv usage
    fs.writeText('seeds.sql', 'INSERT INTO A VALUES (1);  \nINSERT INTO B VALUES (2);  ');
    const logger2 = new InMemoryLogger();
    const cmd2 = new SeedCommand(logger2, fs);
    await cmd2.runDb(provider, ['', absSeed]);
    expect(process.exitCode).toBeUndefined();
    expect(logger2.errors).toHaveLength(0);
  });
});
