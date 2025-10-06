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
  }
  async connect() {}
  async disconnect() {}
  async createTable() {}
  getDialect() {
    return new DummyDialect();
  }
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
  async doExecuteQuery(sql, _params) {
    if (sql.startsWith('SELECT COUNT(')) {
      return [{ count: this.rows.length }];
    }
    return [];
  }
  async doExecuteNonQuery(_sql, _params) {
    return 0;
  }
  async beginTransaction() {}
  async commitTransaction() {}
  async rollbackTransaction() {}
}
class DummyDialect {
  buildSelect() {
    return { query: 'SELECT 1', parameters: [] };
  }
}
class InMemoryCountCache {
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
  // Arrange metadata builder state then finalize via getEntity
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
  // finalize
  MetadataStorage_1.MetadataStorage.getEntity(target);
}
describe('Queryable external CountCache injection (non-breaking opt-in)', () => {
  test('uses external count cache when provided', async () => {
    const provider = new ProviderStub('conn');
    const cache = new InMemoryCountCache();
    // finalize metadata and construct queryable
    registerEntity(E, 'e', 'id');
    const q = new Queryable_1.Queryable(E, provider, undefined, undefined, {
      enableCountCache: true,
      countCache: cache
    });
    // first call populates
    provider.rows = [{}, {}, {}];
    const c1 = await q.count();
    expect(c1).toBe(3);
    // change underlying rows to ensure we hit cache, not DB
    provider.rows = [{}, {}];
    const c2 = await q.count();
    expect(c2).toBe(3);
  });
});
//# sourceMappingURL=count-cache-injection.test.js.map
