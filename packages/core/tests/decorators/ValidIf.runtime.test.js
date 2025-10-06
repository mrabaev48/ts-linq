'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const DbContext_1 = require('../../src/context/DbContext');
const MetadataStorage_1 = require('../../src/metadata/MetadataStorage');
const types_1 = require('../../src/types');
const DatabaseProvider_1 = require('../../src/DatabaseProvider');
class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
  constructor() {
    super('');
    this.providerName = 'test';
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
  getDialect() {
    return { buildSelect: () => ({ query: '', parameters: [] }) };
  }
  async insert(e) {
    return e;
  }
  async update(e) {
    return e;
  }
  async delete() {
    /* no-op */
  }
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
  async doExecuteQuery() {
    return [];
  }
  async doExecuteNonQuery() {
    return 0;
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
class Order {}
class Ctx extends DbContext_1.DbContext {
  constructor() {
    super({ provider: new ProviderStub() });
  }
}
describe('ValidIf runtime (Stage-3 path stored via Reflect)', () => {
  beforeEach(() => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    MetadataStorage_1.MetadataStorage.addEntity(Order, 'Orders');
    const cols = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'amount', columnName: 'amount', type: 'INTEGER', nullable: false },
      { propertyName: 'status', columnName: 'status', type: 'TEXT', nullable: false }
    ];
    cols.forEach((c) => MetadataStorage_1.MetadataStorage.addColumn(Order, c));
    MetadataStorage_1.MetadataStorage.addPrimaryKey(Order, 'id');
    // Simulate @ValidIf decorator storing validation rule on class
    const rules = [
      {
        propertyName: '_rule',
        predicate: (e) => e.status !== 'pending' || e.amount > 0,
        message: 'Pending requires positive amount'
      }
    ];
    Reflect.defineMetadata('orm:validations', rules, Order);
  });
  test('fails saveChanges when rule violated', async () => {
    const ctx = new Ctx();
    const orders = ctx.set(Order);
    const o = new Order();
    o.amount = 0;
    o.status = 'pending';
    orders.add(o);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(types_1.ValidationError);
    await ctx.dispose();
  });
  test('passes saveChanges when rule satisfied', async () => {
    const ctx = new Ctx();
    const orders = ctx.set(Order);
    const o = new Order();
    o.amount = 10;
    o.status = 'pending';
    orders.add(o);
    await expect(ctx.saveChanges()).resolves.toBeGreaterThanOrEqual(0);
    await ctx.dispose();
  });
});
//# sourceMappingURL=ValidIf.runtime.test.js.map
