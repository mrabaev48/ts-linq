import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { ColumnMetadata } from '../src/types';
import { SqlLogger, SqlLoggerFactory } from '../src/types';

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
  public starts: any[] = [];
  queryStart(info: any): void {
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
  public users!: any;
  constructor(p: 'sqlite' | 'postgresql' | 'mysql' | 'mssql', loggerFactory?: SqlLoggerFactory) {
    super({ provider: p, connectionString: ':memory:', loggerFactory });
  }
}

describe('SqlLoggerFactory integration', () => {
  test('factory is used to create logger for selected provider', async () => {
    const factory = new TestLoggerFactory();
    const ctx = new Ctx('sqlite', factory);
    await ctx.ensureCreated();
    // a simple query to trigger queryStart using Queryable to avoid loader path
    // Trigger any simple query via provider to ensure logger is created and used
    await (ctx as any).provider.executeQuery('SELECT 1');
    expect(factory.createdFor[0]).toBe('sqlite');
  });
});
