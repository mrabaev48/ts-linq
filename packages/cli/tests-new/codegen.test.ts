import { DatabaseProvider } from '@ts-linq/core';
import type { SqlDialect } from '@ts-linq/types';

import { GenerateEntitiesCommand } from '../src/commands/GenerateEntitiesCommand';
import { GenerateEntityCommand } from '../src/commands/GenerateEntityCommand';
import { EntityTemplateBuilder } from '../src/generators/EntityTemplateBuilder';
import type { FileSystem } from '../src/ports/FileSystem';
import type { Logger } from '../src/ports/Logger';

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

// Mock schema-inspect helpers used by codegen
jest.mock('../src/schema-inspect', () => {
  return {
    inspectTable: jest.fn().mockResolvedValue([
      { name: 'id', type: 'INTEGER', isPrimaryKey: true },
      { name: 'name', type: 'TEXT', isPrimaryKey: false }
    ]),
    listAllTables: jest.fn().mockResolvedValue(['users', 'orders'])
  };
});

// Minimal provider
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
  async findWhereIn<T extends object>(_e: new () => T, _col: string, _v: unknown[]): Promise<T[]> {
    return [];
  }
  protected async doExecuteQuery<T>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
  async beginTransaction() {}
  async commitTransaction() {}
  async rollbackTransaction() {}
}

describe('CLI - Codegen: GenerateEntityCommand', () => {
  test('prints usage and sets exit code when name missing', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    class Template extends EntityTemplateBuilder {
      public override buildDefault(_n: string, _t: string): string {
        return '';
      }
      public override buildFromColumns(_n: string, _t: string, _c: unknown[]): string {
        return '';
      }
    }
    const cmd = new GenerateEntityCommand(logger, fs, new Template());
    await cmd.runDb(new MinimalProvider(), ['generate:entity']);
    expect(process.exitCode).toBe(2);
    expect(logger.errors[0]).toMatch(/Usage: ts-linq generate entity/);
  });

  test('generates default entity when from-table not specified', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    class Template2 extends EntityTemplateBuilder {
      public override buildDefault(name: string, table: string): string {
        return `// ${name} from ${table}`;
      }
      public override buildFromColumns(_n: string, _t: string, _c: unknown[]): string {
        return '';
      }
    }
    const cmd = new GenerateEntityCommand(logger, fs, new Template2());
    await cmd.runDb(new MinimalProvider(), ['generate', 'entity', 'user']);
    const info = logger.infos.find((x) => x.startsWith('Created entity'));
    expect(info).toBeTruthy();
    // default writes to src/entities/User.ts
    const path = info!.split(' at ')[1];
    expect(path.endsWith('/src/entities/User.ts')).toBe(true);
    expect(fs.readText(path)).toBe('// User from users');
  });

  test('generates entity from table when --from-table provided', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    class Template3 extends EntityTemplateBuilder {
      public override buildDefault(): string {
        return '';
      }
      public override buildFromColumns(
        name: string,
        table: string,
        cols: Array<{ name: string }>
      ): string {
        return `// ${name} <- ${table} (${cols.map((c) => c.name).join(',')})`;
      }
    }
    const cmd = new GenerateEntityCommand(logger, fs, new Template3());
    await cmd.runDb(new MinimalProvider(), ['generate', 'entity', 'account', '--from-table=users']);
    const info = logger.infos.find((x) => x.startsWith('Created entity'));
    const path = info!.split(' at ')[1];
    expect(fs.readText(path)).toMatch(/Account <- users/);
  });

  test('fails when entity file already exists', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    // pre-create file
    const cwd = process.cwd();
    const existing = `${cwd}/src/entities/Product.ts`;
    fs.ensureDir(`${cwd}/src`);
    fs.ensureDir(`${cwd}/src/entities`);
    fs.writeText(existing, '// existing');

    class Template4 extends EntityTemplateBuilder {
      public override buildDefault(): string {
        return '//';
      }
      public override buildFromColumns(): string {
        return '//';
      }
    }
    const cmd = new GenerateEntityCommand(logger, fs, new Template4());
    await cmd.runDb(new MinimalProvider(), ['generate', 'entity', 'Product']);
    expect(process.exitCode).toBe(2);
    expect(logger.errors[0]).toMatch(/Entity already exists/);
  });
});

describe('CLI - Codegen: GenerateEntitiesCommand', () => {
  test('generates entities for all tables, skips existing files', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    class Template5 extends EntityTemplateBuilder {
      public override buildFromColumns(name: string, table: string): string {
        return `// ${name} <- ${table}`;
      }
    }
    const cmd = new GenerateEntitiesCommand(logger, fs, new Template5());

    // pre-create one file to test skipping
    const cwd = process.cwd();
    fs.ensureDir(`${cwd}/src`);
    fs.ensureDir(`${cwd}/src/entities`);
    fs.writeText(`${cwd}/src/entities/Users.ts`, '// existing');

    await cmd.runDb(new MinimalProvider(), ['generate', 'entities']);
    // expect Orders.ts created (Users.ts skipped)
    const ordersPath = `${cwd}/src/entities/Orders.ts`;
    expect(fs.exists(ordersPath)).toBe(true);
    expect(fs.readText(ordersPath)).toMatch(/Orders <- orders/);
    // should log creation of Orders
    expect(logger.infos.some((m) => m.includes('Created entity Orders'))).toBe(true);
  });
});

// Mocks for helpers used by codegen commands
jest.mock('../src/utils', () => {
  return {
    ensureDir: jest.fn((_p: string) => undefined),
    resolveDialect: jest.fn((label: string) => label)
  };
});

// (schema-inspect) already mocked at top of file; tests override via requireMock where needed

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
    async beginTransaction() {}
    async commitTransaction() {}
    async rollbackTransaction() {}
  }
  const provider: DatabaseProvider = new MinimalProvider();

  test('GenerateEntityCommand creates default entity from name and logs path', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    class FakeEntityTemplateBuilder extends EntityTemplateBuilder {
      buildDefault(entityName: string, tableName: string): string {
        return `// ${entityName} from ${tableName}`;
      }

      buildFromColumns(_entityName: string, _tableName: string, _cols: unknown): string {
        return `// columns`;
      }
    }

    const cmd = new GenerateEntityCommand(logger, fs, new FakeEntityTemplateBuilder());
    await cmd.runDb(provider, ['generate', 'entity', 'UserAccount', '--dir', 'src/entities']);

    const info = logger.infos.find((x) => x.startsWith('Created entity UserAccount at '));
    expect(info).toBeDefined();
    const file = info!.replace('Created entity UserAccount at ', '');
    expect(file).toMatch(/src\/entities\/UserAccount\.ts$/);
    // ensure content was written

    expect((fs as unknown as { readText(p: string): string }).readText(file)).toContain(
      'UserAccount'
    );
  });

  test('GenerateEntityCommand creates entity from table definition', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    class FakeEntityTemplateBuilder2 extends EntityTemplateBuilder {
      buildDefault(_entityName: string, _tableName: string): string {
        return '// default';
      }

      buildFromColumns(_entityName: string, _tableName: string, _cols: unknown): string {
        return `// from columns`;
      }
    }
    const schemaInspect1 = jest.requireMock('../src/schema-inspect');
    schemaInspect1.inspectTable.mockResolvedValue([{ name: 'id' }, { name: 'name' }]);

    const cmd = new GenerateEntityCommand(logger, fs, new FakeEntityTemplateBuilder2());
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
    class FakeEntityTemplateBuilder3 extends EntityTemplateBuilder {
      buildDefault(_entityName: string, _tableName: string): string {
        return '// default';
      }

      buildFromColumns(_entityName: string, _tableName: string, _cols: unknown): string {
        return `// entity`;
      }
    }
    const schemaInspect2 = jest.requireMock('../src/schema-inspect');
    schemaInspect2.listAllTables.mockResolvedValue([]);

    const cmd = new GenerateEntitiesCommand(logger, fs, new FakeEntityTemplateBuilder3());
    await cmd.runDb(provider, ['generate', 'entities', '--dir', 'src/entities']);

    expect(logger.infos).toEqual(expect.arrayContaining(['No tables found to generate entities.']));
  });

  test('GenerateEntitiesCommand generates entities for each table, skipping existing files', async () => {
    const logger = new InMemoryLogger();
    const fs = new InMemoryFs();
    class FakeEntityTemplateBuilder4 extends EntityTemplateBuilder {
      buildDefault(_entityName: string, _tableName: string): string {
        return '// default';
      }
      buildFromColumns(entityName: string, tableName: string, _cols: unknown): string {
        return `// ${entityName} from ${tableName}`;
      }
    }
    const schemaInspect3 = jest.requireMock('../src/schema-inspect');
    schemaInspect3.listAllTables.mockResolvedValue(['users', 'orders']);
    schemaInspect3.inspectTable.mockResolvedValue([{ name: 'id' }]);

    const cmd = new GenerateEntitiesCommand(logger, fs, new FakeEntityTemplateBuilder4());

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
