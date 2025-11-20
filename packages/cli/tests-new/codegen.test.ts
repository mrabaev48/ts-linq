import { GenerateEntityCommand } from '../src/commands/GenerateEntityCommand';
import { GenerateEntitiesCommand } from '../src/commands/GenerateEntitiesCommand';
import type { Logger } from '../src/ports/Logger';
import type { FileSystem } from '../src/ports/FileSystem';
import { DatabaseProvider } from '@ts-linq/core';
import type { SqlDialect } from '@ts-linq/types';

// Mocks for helpers used by codegen commands
jest.mock('../src/utils', () => {
  return {
    ensureDir: jest.fn((_p: string) => undefined),
    resolveDialect: jest.fn((label: string) => label)
  };
});

jest.mock('../src/schema-inspect', () => {
  return {
    inspectTable: jest.fn(),
    listAllTables: jest.fn()
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

describe('CLI - Code Generation (tests-new)', () => {
  class MinimalProvider extends DatabaseProvider {
    constructor() {
      super('mock://');
      (this as unknown as { providerName: string }).providerName = 'postgresql';
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
    async findWhere<T extends object>(_entityClass: new () => T, _c: Record<string, unknown>): Promise<T[]> { return [] as unknown as T[]; }
    async findWhereIn<T extends object>(_e: new () => T, _col: string, _v: unknown[]): Promise<T[]> { return [] as unknown as T[]; }
    protected async doExecuteQuery<T>(): Promise<T[]> { return [] as unknown as T[]; }
    protected async doExecuteNonQuery(): Promise<number> { return 0; }
    async beginTransaction() {}
    async commitTransaction() {}
    async rollbackTransaction() {}
  }
  const provider: DatabaseProvider = new MinimalProvider();

  test('GenerateEntityCommand creates default entity from name and logs path', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    class FakeEntityTemplateBuilder {
      buildDefault(entityName: string, tableName: string): string {
        return `// ${entityName} from ${tableName}`;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      buildFromColumns(_entityName: string, _tableName: string, _cols: unknown): string {
        return `// columns`;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      mapTsType(_t: unknown): string {
        return 'string';
      }
    }

    const cmd = new GenerateEntityCommand(logger, fs, new FakeEntityTemplateBuilder() as unknown as any);
    await cmd.runDb(provider, ['generate', 'entity', 'UserAccount', '--dir', 'src/entities']);

    const info = logger.infos.find((x) => x.startsWith('Created entity UserAccount at '));
    expect(info).toBeDefined();
    const file = info!.replace('Created entity UserAccount at ', '');
    expect(file).toMatch(/src\/entities\/UserAccount\.ts$/);
    // ensure content was written
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect((fs as unknown as { readText(p: string): string }).readText(file)).toContain(
      'UserAccount'
    );
  });

  test('GenerateEntityCommand creates entity from table definition', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    class FakeEntityTemplateBuilder2 {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      buildDefault(_entityName: string, _tableName: string): string {
        return '// default';
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      buildFromColumns(_entityName: string, _tableName: string, _cols: unknown): string {
        return `// from columns`;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      mapTsType(_t: unknown): string {
        return 'string';
      }
    }
    const { inspectTable } = jest.requireMock('../src/schema-inspect') as {
      inspectTable: jest.Mock<Promise<unknown>, [unknown, string, string, string | undefined]>;
    };
    inspectTable.mockResolvedValue([{ name: 'id' }, { name: 'name' }]);

    const cmd = new GenerateEntityCommand(logger, fs, new FakeEntityTemplateBuilder2() as unknown as any);
    await cmd.runDb(provider, [
      'generate',
      'entity',
      'user-account',
      '--from-table',
      'users',
      '--dir',
      'src/entities'
    ]);

    const info = logger.infos.find((x) => x.startsWith('Created entity UserAccount at '));
    expect(info).toBeDefined();
  });

  test('GenerateEntitiesCommand logs when no tables are found', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    class FakeEntityTemplateBuilder3 {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      buildDefault(_entityName: string, _tableName: string): string {
        return '// default';
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      buildFromColumns(_entityName: string, _tableName: string, _cols: unknown): string {
        return `// entity`;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      mapTsType(_t: unknown): string {
        return 'string';
      }
    }
    const { listAllTables } = jest.requireMock('../src/schema-inspect') as {
      listAllTables: jest.Mock<Promise<string[]>, [unknown, string, string | undefined]>;
    };
    listAllTables.mockResolvedValue([]);

    const cmd = new GenerateEntitiesCommand(logger, fs, new FakeEntityTemplateBuilder3() as unknown as any);
    await cmd.runDb(provider, ['generate', 'entities', '--dir', 'src/entities']);

    expect(logger.infos).toEqual(expect.arrayContaining(['No tables found to generate entities.']))
  });

  test('GenerateEntitiesCommand generates entities for each table, skipping existing files', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    class FakeEntityTemplateBuilder4 {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      buildDefault(_entityName: string, _tableName: string): string {
        return '// default';
      }
      buildFromColumns(entityName: string, tableName: string, _cols: unknown): string {
        return `// ${entityName} from ${tableName}`;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      mapTsType(_t: unknown): string {
        return 'string';
      }
    }
    const mocks = jest.requireMock('../src/schema-inspect') as {
      listAllTables: jest.Mock<Promise<string[]>, [unknown, string, string | undefined]>;
      inspectTable: jest.Mock<Promise<unknown>, [unknown, string, string, string | undefined]>;
    };
    mocks.listAllTables.mockResolvedValue(['users', 'orders']);
    mocks.inspectTable.mockResolvedValue([{ name: 'id' }]);

    const cmd = new GenerateEntitiesCommand(logger, fs, new FakeEntityTemplateBuilder4() as unknown as any);

    // Pre-create Users file to test skipping
    const preCreated = `${process.cwd()}/src/entities/Users.ts`;
    (fs as unknown as FileSystem).ensureDir(`${process.cwd()}/src/entities`);
    (fs as unknown as FileSystem).writeText(preCreated, '// existing');

    await cmd.runDb(provider, ['generate', 'entities', '--dir', 'src/entities']);

    // Expect Orders was created and Users was skipped
    const createdOrdersInfo = logger.infos.find((x) =>
      x.startsWith("Created entity Orders for table 'orders' at ")
    );
    expect(createdOrdersInfo).toBeDefined();
    expect(logger.infos.find((x) => x.includes('Created entity Users '))).toBeUndefined();
  });
});


