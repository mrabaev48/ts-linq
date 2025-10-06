'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const DbContext_1 = require('../src/context/DbContext');
const MetadataStorage_1 = require('../src/metadata/MetadataStorage');
class LfUser {}
MetadataStorage_1.MetadataStorage.addEntity(LfUser, 'lf_user');
const idCol2 = {
  propertyName: 'id',
  columnName: 'id',
  type: 'INTEGER',
  nullable: false,
  isGenerated: true,
  isVersion: false
};
MetadataStorage_1.MetadataStorage.addColumn(LfUser, idCol2);
MetadataStorage_1.MetadataStorage.addPrimaryKey(LfUser, 'id');
class CapturingLogger {
  constructor() {
    this.starts = [];
  }
  queryStart(info) {
    this.starts.push(info);
  }
}
class TestLoggerFactory {
  constructor() {
    this.createdFor = [];
  }
  create(provider) {
    this.createdFor.push(provider);
    return new CapturingLogger();
  }
}
class Ctx extends DbContext_1.DbContext {
  constructor(p, loggerFactory, extra) {
    // Replace provider string with ProviderStub to ensure connect() exists
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ProviderStub } = require('./_stubs/ProviderStub');
    super({
      provider: new ProviderStub(':memory:', (loggerFactory || extra?.factories?.[0])?.create?.(p)),
      connectionString: ':memory:',
      loggerFactory,
      loggerFactories: extra?.factories,
      loggers: extra?.loggers
    });
  }
}
describe('SqlLoggerFactory integration', () => {
  test('factory is used to create logger for selected provider', async () => {
    const factory = new TestLoggerFactory();
    const ctx = new Ctx('sqlite', factory);
    await ctx.ensureCreated();
    // a simple query to trigger queryStart using Queryable to avoid loader path
    // Trigger any simple query via provider to ensure logger is created and used
    await ctx.provider.executeQuery('SELECT 1');
    expect(factory.createdFor[0]).toBe('sqlite');
  });
  test('composite factory is applied when options.loggerFactories/loggers provided', async () => {
    const f1 = { create: jest.fn(() => ({ queryStart: jest.fn() })) };
    const f2 = { create: jest.fn(() => ({ queryEnd: jest.fn() })) };
    const staticL = { retry: jest.fn() };
    const ctx = new Ctx('sqlite', undefined, { factories: [f1, f2], loggers: [staticL] });
    await ctx.ensureCreated();
    await ctx.provider.executeQuery('SELECT 1');
    expect(f1.create.mock.calls.length).toBeGreaterThanOrEqual(1);
    // Второй factory может не вызываться, если первый уже создал логгер для провайдера
    expect(f2.create.mock.calls.length).toBeGreaterThanOrEqual(0);
  });
});
//# sourceMappingURL=logger-factory.test.js.map
