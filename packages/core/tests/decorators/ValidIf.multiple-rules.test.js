'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const DbContext_1 = require('../../src/context/DbContext');
const MetadataStorage_1 = require('../../src/metadata/MetadataStorage');
const DatabaseProvider_1 = require('../../src/DatabaseProvider');
const ValidIf_1 = require('../../src/decorators/ValidIf');
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
describe('Multiple ValidIf rules', () => {
  beforeEach(() => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    MetadataStorage_1.MetadataStorage.addEntity(User, 'Users');
    const cols = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false },
      { propertyName: 'email', columnName: 'email', type: 'TEXT', nullable: false }
    ];
    cols.forEach((c) => MetadataStorage_1.MetadataStorage.addColumn(User, c));
    MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
    // Attach two rules to the same property (name): non-empty and min length 3
    (0, ValidIf_1.MinLengthOf)(3, 'Name too short')(undefined, {
      kind: 'field',
      name: 'name',
      addInitializer: (fn) => fn.call(User.prototype)
    });
    (0, ValidIf_1.ValidIfOf)((u) => !!u.name, 'Name required')(undefined, {
      kind: 'field',
      name: 'name',
      addInitializer: (fn) => fn.call(User.prototype)
    });
  });
  test('aggregates multiple errors for the same property', async () => {
    const ctx = new Ctx();
    const set = ctx.set(User);
    const u = new User();
    u.email = 'a@b';
    u.name = ''; // violates both rules
    set.add(u);
    try {
      await ctx.saveChanges();
      fail('expected ValidationError');
    } catch (e) {
      const ve = e;
      const messages = (ve.details || [])
        .filter((d) => d.property === 'name')
        .map((d) => d.message);
      expect(messages.some((m) => m.includes('Name required'))).toBe(true);
      expect(messages.some((m) => m.includes('too short'))).toBe(true);
    }
    await ctx.dispose();
  });
});
//# sourceMappingURL=ValidIf.multiple-rules.test.js.map
