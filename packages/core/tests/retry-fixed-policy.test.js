'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const DbContext_1 = require('../src/context/DbContext');
const ProviderStub_1 = require('./_stubs/ProviderStub');
const RetryPolicies_1 = require('../src/utils/RetryPolicies');
const MetadataStorage_1 = require('../src/metadata/MetadataStorage');
class FxUser {}
MetadataStorage_1.MetadataStorage.addEntity(FxUser, 'fx_user');
const idCol = {
  propertyName: 'id',
  columnName: 'id',
  type: 'INTEGER',
  nullable: false,
  isGenerated: true,
  isVersion: false
};
MetadataStorage_1.MetadataStorage.addColumn(FxUser, idCol);
MetadataStorage_1.MetadataStorage.addPrimaryKey(FxUser, 'id');
class Ctx extends DbContext_1.DbContext {
  constructor() {
    super({
      provider: new ProviderStub_1.ProviderStub(':memory:'),
      connectionString: ':memory:',
      retryPolicy: new RetryPolicies_1.FixedIntervalRetryPolicy(25)
    });
  }
}
describe('FixedIntervalRetryPolicy', () => {
  test('retries using fixed delay', async () => {
    const ctx = new Ctx();
    await ctx.ensureCreated();
    const p = ctx.provider;
    let fails = 1;
    const spy = jest.spyOn(p, 'doExecuteNonQuery').mockImplementation(() => {
      if (fails-- > 0) {
        throw new Error('timeout');
      }
      return 1;
    });
    const t0 = Date.now();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).resolves.toBe(1);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(20);
    spy.mockRestore();
  });
});
//# sourceMappingURL=retry-fixed-policy.test.js.map
