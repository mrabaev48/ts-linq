'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const Queryable_1 = require('../src/query/Queryable');
const DatabaseProvider_1 = require('../src/DatabaseProvider');
const MetadataStorage_1 = require('../src/metadata/MetadataStorage');
class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
  constructor() {
    super(...arguments);
    this.rows = [];
    this.calls = 0;
    this.dialect = new DummyDialect();
  }
  async connect() {}
  async disconnect() {}
  async createTable() {}
  async insert(entity) {
    return entity;
  }
  async update(entity) {
    return entity;
  }
  async delete() {}
  async findById() {
    return null;
  }
  async findAll() {
    return [];
  }
  async findWhere() {
    return [];
  }
  async findWhereIn() {
    return [];
  }
  async beginTransaction() {}
  async commitTransaction() {}
  async rollbackTransaction() {}
  getDialect() {
    return this.dialect;
  }
  async doExecuteQuery(sql, _params) {
    this.calls++;
    if (sql.startsWith('SELECT COUNT(')) {
      return [{ count: this.rows.length }];
    }
    return [];
  }
  async doExecuteNonQuery(_sql, _params) {
    return 0;
  }
}
class DummyDialect {
  constructor() {
    this.builds = 0;
  }
  buildSelect(_entityClass, _options) {
    this.builds++;
    return { query: 'SELECT 1', parameters: [] };
  }
}
class ExtSqlCache {
  constructor() {
    this.map = new Map();
  }
  get(key) {
    return this.map.get(key);
  }
  set(key, value) {
    this.map.set(key, value);
  }
  clear() {
    this.map.clear();
  }
  size() {
    return this.map.size;
  }
}
class ExtCountCache {
  constructor() {
    this.map = new Map();
  }
  get(key) {
    return this.map.get(key);
  }
  set(key, entry) {
    this.map.set(key, entry);
  }
  clear() {
    this.map.clear();
  }
}
class E {}
function registerEntity(target, table, pk) {
  MetadataStorage_1.MetadataStorage.addEntity(target, table);
  MetadataStorage_1.MetadataStorage.addColumn(target, {
    propertyName: pk,
    columnName: pk,
    type: 'INTEGER',
    nullable: false,
    isGenerated: true,
    isVersion: false
  });
  MetadataStorage_1.MetadataStorage.addPrimaryKey(target, pk);
  MetadataStorage_1.MetadataStorage.getEntity(target);
}
describe('PerformanceOptions external caches injection', () => {
  beforeEach(() => {
    registerEntity(E, 'e', 'id');
  });
  test('sqlCache reduces dialect builds via Queryable path', async () => {
    const provider = new ProviderStub('conn');
    provider.dialect = new DummyDialect();
    const sqlCache = new ExtSqlCache();
    const q = new Queryable_1.Queryable(E, provider, undefined, undefined, { sqlCache });
    await q.toArray();
    await q.toArray();
    expect(provider.dialect.builds).toBe(1);
    expect(sqlCache.size()).toBe(1);
  });
  test('countCache returns cached value on second call', async () => {
    const provider = new ProviderStub('conn');
    provider._dialect = new DummyDialect();
    const countCache = new ExtCountCache();
    const q = new Queryable_1.Queryable(E, provider, undefined, undefined, {
      countCache,
      enableCountCache: true
    });
    provider.rows = [{}, {}, {}];
    const a = await q.count();
    expect(a).toBe(3);
    provider.rows = [{}];
    const b = await q.count();
    expect(b).toBe(3);
  });
});
//# sourceMappingURL=external-caches-injection.test.js.map
