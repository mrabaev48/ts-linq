'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Queryable_1 = require('../../src/query/Queryable');
const MetadataStorage_1 = require('../../src/metadata/MetadataStorage');
const DatabaseProvider_1 = require('../../src/DatabaseProvider');
class User {}
class Order {}
/** Minimal dialect that renders SELECT and WHERE clauses and collects parameters. */
const stubDialect = {
  buildSelect: (ctor, opts) => {
    const select = opts.select?.length ? opts.select.join(', ') : '*';
    const meta = MetadataStorage_1.MetadataStorage.getEntity(ctor);
    const table = meta?.tableName ?? 'unknown';
    let query = `SELECT ${select} FROM ${table}`;
    const parameters = [];
    if (opts.where && opts.where.length) {
      query += ' WHERE ' + opts.where.map((w) => w.condition).join(' AND ');
      for (const w of opts.where) parameters.push(...w.parameters);
    }
    if (opts.selectParams?.length) parameters.push(...opts.selectParams);
    return { query, parameters };
  }
};
class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
  constructor() {
    super('');
    this.providerName = 'test';
  }
  getDialect() {
    return stubDialect;
  }
  async doExecuteQuery(_sql, _params) {
    this.lastQuery = { sql: _sql, params: _params };
    return [];
  }
  async doExecuteNonQuery(_sql, _params) {
    return 0;
  }
  async connect() {
    this.isConnected = true;
  }
  async disconnect() {
    this.isConnected = false;
  }
  async createTable() {
    /* no-op */
  }
  async insert(e, _cls) {
    return e;
  }
  async update(e, _cls) {
    return e;
  }
  async delete(_e, _cls) {
    /* no-op */
  }
  async findById(_id, _cls) {
    return null;
  }
  async findAll(_cls) {
    return [];
  }
  async findWhere(_cls, _cond) {
    return [];
  }
  async findWhereIn(_cls, _col, _v) {
    return [];
  }
  async beginTransaction() {
    this.inTransaction = true;
  }
  async commitTransaction() {
    this.inTransaction = false;
  }
  async rollbackTransaction() {
    this.inTransaction = false;
  }
}
describe('Subqueries & EXISTS', () => {
  let provider;
  let users;
  let orders;
  beforeEach(() => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    // users
    MetadataStorage_1.MetadataStorage.addEntity(User, 'users');
    MetadataStorage_1.MetadataStorage.addColumn(User, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage_1.MetadataStorage.addColumn(User, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
    // orders
    MetadataStorage_1.MetadataStorage.addEntity(Order, 'orders');
    MetadataStorage_1.MetadataStorage.addColumn(Order, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage_1.MetadataStorage.addColumn(Order, {
      propertyName: 'userId',
      columnName: 'userId',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage_1.MetadataStorage.addColumn(Order, {
      propertyName: 'amount',
      columnName: 'amount',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage_1.MetadataStorage.addPrimaryKey(Order, 'id');
    provider = new ProviderStub();
    users = new Queryable_1.Queryable(User, provider);
    orders = new Queryable_1.Queryable(Order, provider);
  });
  test('whereExists embeds EXISTS (subquery) in WHERE', async () => {
    // simple EXISTS without correlation (correlation can be added in future API)
    const q = users.whereExists(orders);
    await q.toArray();
    expect(provider.lastQuery?.sql).toContain('WHERE EXISTS (SELECT');
    expect(provider.lastQuery?.sql).toContain('FROM orders');
  });
  test('whereInSubquery embeds IN (subquery) for a column', async () => {
    const q = users.whereInSubquery('id', orders);
    await q.toArray();
    expect(provider.lastQuery?.sql).toContain('WHERE id IN (SELECT');
    expect(provider.lastQuery?.sql).toContain('FROM orders');
  });
});
//# sourceMappingURL=Subqueries.test.js.map
