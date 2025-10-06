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
class User {}
class Ctx extends DbContext_1.DbContext {
  constructor() {
    super({ provider: new ProviderStub() });
  }
}
describe('Validation order: base before ValidIf', () => {
  beforeEach(() => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    MetadataStorage_1.MetadataStorage.addEntity(User, 'Users');
    const cols = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false, length: 10 }
    ];
    cols.forEach((c) => MetadataStorage_1.MetadataStorage.addColumn(User, c));
    MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
    // ValidIf: name must be non-empty and <= 10 (redundant with base length)
    const rules = [
      {
        propertyName: 'name',
        predicate: (e) => !!e.name && e.name.length <= 10,
        message: 'Name required and <= 10'
      }
    ];
    Reflect.defineMetadata('orm:validations', rules, User);
  });
  test('NotNull/length are enforced; error contains base check message', async () => {
    const ctx = new Ctx();
    const set = ctx.set(User);
    const u = new User();
    // leave name undefined to trigger NotNull
    set.add(u);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(types_1.ValidationError);
    try {
      await ctx.saveChanges();
    } catch (e) {
      const ve = e;
      const msgs = (ve.details || []).map((d) => d.message);
      expect(msgs.some((m) => m.includes('Value cannot be null'))).toBe(true);
    }
    await ctx.dispose();
  });
});
//# sourceMappingURL=ValidIf.order.test.js.map
