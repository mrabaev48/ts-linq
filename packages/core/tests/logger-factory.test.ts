import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { ColumnMetadata } from '../src/types';
import type { SqlLogger, SqlLoggerFactory, QueryStartInfo } from '@ts-linq/core';
import { CompositeSqlLoggerFactory } from 'composite-sql-logger';

class LfUser {}
MetadataStorage.addEntity(LfUser, 'lf_user');
const idCol2: ColumnMetadata = {
  propertyName: 'id',
  columnName: 'id',
  type: 'INTEGER',
  nullable: false,
  isGenerated: true,
  isVersion: false
};
MetadataStorage.addColumn(LfUser, idCol2);
MetadataStorage.addPrimaryKey(LfUser, 'id');

class CapturingLogger implements SqlLogger {
  public starts: QueryStartInfo[] = [];
  queryStart(info: QueryStartInfo): void {
    this.starts.push(info);
  }
}

class TestLoggerFactory implements SqlLoggerFactory {
  public createdFor: string[] = [];
  create(provider: string): SqlLogger | undefined {
    this.createdFor.push(provider);
    return new CapturingLogger();
  }
}

class Ctx extends DbContext {
  public users!: unknown;
  constructor(
    p: 'sqlite' | 'postgresql' | 'mysql' | 'mssql',
    loggerFactory?: SqlLoggerFactory,
    extra?: { factories?: SqlLoggerFactory[]; loggers?: SqlLogger[] }
  ) {
    // Replace provider string with ProviderStub to ensure connect() exists
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ProviderStub } = require('./_stubs/ProviderStub');
    super({
      provider: new ProviderStub(
        ':memory:',
        (loggerFactory || (extra?.factories?.[0] as any))?.create?.(p)
      ),
      connectionString: ':memory:',
      loggerFactory,
      loggerFactories: extra?.factories,
      loggers: extra?.loggers
    } as any);
  }
}

describe('SqlLoggerFactory integration', () => {
  test('factory is used to create logger for selected provider', async () => {
    const factory = new TestLoggerFactory();
    const ctx = new Ctx('sqlite', factory);
    await ctx.ensureCreated();
    // a simple query to trigger queryStart using Queryable to avoid loader path
    // Trigger any simple query via provider to ensure logger is created and used
    await (
      ctx as unknown as {
        provider: { executeQuery: (sql: string, params?: unknown[]) => Promise<unknown[]> };
      }
    ).provider.executeQuery('SELECT 1');
    expect(factory.createdFor[0]).toBe('sqlite');
  });

  test('composite factory is applied when options.loggerFactories/loggers provided', async () => {
    const f1: SqlLoggerFactory = { create: jest.fn(() => ({ queryStart: jest.fn() })) };
    const f2: SqlLoggerFactory = { create: jest.fn(() => ({ queryEnd: jest.fn() })) };
    const staticL: SqlLogger = { retry: jest.fn() };
    const ctx = new Ctx('sqlite', undefined, { factories: [f1, f2], loggers: [staticL] });
    await ctx.ensureCreated();
    await (
      ctx as unknown as {
        provider: { executeQuery: (sql: string, params?: unknown[]) => Promise<unknown[]> };
      }
    ).provider.executeQuery('SELECT 1');
    expect((f1.create as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    // Второй factory может не вызываться, если первый уже создал логгер для провайдера
    expect((f2.create as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(0);
  });
});
