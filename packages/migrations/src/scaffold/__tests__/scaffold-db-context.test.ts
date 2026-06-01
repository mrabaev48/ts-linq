import type { DatabaseProvider } from '@ts-linq/core';
import type { DatabaseModel, DbIntrospector } from '@ts-linq/types';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { scaffoldDbContext } from '../scaffold-db-context';

function makeModel(partial?: Partial<DatabaseModel>): DatabaseModel {
  return {
    tables: [
      {
        name: 'products',
        columns: [
          {
            name: 'id',
            dbType: 'int',
            ormType: 'INTEGER',
            nullable: false,
            isPrimary: true,
            isIdentity: true
          },
          {
            name: 'name',
            dbType: 'varchar',
            ormType: 'TEXT',
            nullable: false,
            isPrimary: false,
            isIdentity: false
          }
        ],
        primaryKeys: ['id'],
        foreignKeys: [],
        indexes: []
      }
    ],
    ...partial
  };
}

function makeIntrospector(model: DatabaseModel): DbIntrospector {
  return { introspect: jest.fn(async () => model) };
}

function makeProvider(): DatabaseProvider {
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    executeQuery: jest.fn()
  } as unknown as DatabaseProvider;
}

describe('scaffoldDbContext', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates entity file and DbContext file', async () => {
    const model = makeModel();
    await scaffoldDbContext(makeProvider(), makeIntrospector(model), {
      outputDir: tmpDir,
      contextName: 'TestContext'
    });

    expect(fs.existsSync(path.join(tmpDir, 'Product.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'TestContext.ts'))).toBe(true);
  });

  it('entity file contains correct class name and decorators', async () => {
    const model = makeModel();
    await scaffoldDbContext(makeProvider(), makeIntrospector(model), { outputDir: tmpDir });

    const content = fs.readFileSync(path.join(tmpDir, 'Product.ts'), 'utf8');
    expect(content).toContain('export class Product');
    expect(content).toContain('@PrimaryKey(');
    expect(content).toContain('@Column(');
  });

  it('filters tables when tables option is provided', async () => {
    const model = makeModel({
      tables: [
        { name: 'products', columns: [], primaryKeys: [], foreignKeys: [], indexes: [] },
        { name: 'orders', columns: [], primaryKeys: [], foreignKeys: [], indexes: [] }
      ]
    });
    await scaffoldDbContext(makeProvider(), makeIntrospector(model), {
      outputDir: tmpDir,
      tables: ['products']
    });

    expect(fs.existsSync(path.join(tmpDir, 'Product.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'Order.ts'))).toBe(false);
  });

  it('uses database names when useDatabaseNames=true', async () => {
    const model = makeModel();
    await scaffoldDbContext(makeProvider(), makeIntrospector(model), {
      outputDir: tmpDir,
      useDatabaseNames: true
    });

    expect(fs.existsSync(path.join(tmpDir, 'Products.ts'))).toBe(true);
  });
});
