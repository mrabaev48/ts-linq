'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const DbContext_1 = require('../src/context/DbContext');
const ProviderStub_1 = require('./_stubs/ProviderStub');
const MetadataStorage_1 = require('../src/metadata/MetadataStorage');
const RetryPolicies_1 = require('../src/utils/RetryPolicies');
class RsUser {}
MetadataStorage_1.MetadataStorage.addEntity(RsUser, 'rs_user');
const idCol = {
  propertyName: 'id',
  columnName: 'id',
  type: 'INTEGER',
  nullable: false,
  isGenerated: true,
  isVersion: false
};
MetadataStorage_1.MetadataStorage.addColumn(RsUser, idCol);
MetadataStorage_1.MetadataStorage.addPrimaryKey(RsUser, 'id');
class Ctx extends DbContext_1.DbContext {
  constructor(policy) {
    const provider = new ProviderStub_1.ProviderStub(
      ':memory:',
      undefined,
      undefined,
      undefined,
      policy
    );
    super({ provider, connectionString: ':memory:' });
  }
}
describe('RetryPolicy strategies', () => {
  test('NoRetryPolicy disables retries', async () => {
    const ctx = new Ctx(new RetryPolicies_1.NoRetryPolicy());
    await ctx.ensureCreated();
    // Spy on provider.executeWithRetry through executeNonQuery by forcing an error and checking timing
    const p = ctx.provider;
    const spy = jest.spyOn(p, 'doExecuteNonQuery').mockImplementation(() => {
      const err = new Error('timeout');
      err.message = 'timeout';
      throw err;
    });
    const t0 = Date.now();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(50);
    spy.mockRestore();
  });
  test('ExponentialBackoffRetryPolicy retries with backoff', async () => {
    const ctx = new Ctx(new RetryPolicies_1.ExponentialBackoffRetryPolicy({ baseDelayMs: 10 }));
    await ctx.ensureCreated();
    const p = ctx.provider;
    let fails = 2;
    const spy = jest.spyOn(p, 'doExecuteNonQuery').mockImplementation(() => {
      if (fails-- > 0) {
        const err = new Error('timeout');
        err.message = 'timeout';
        throw err;
      }
      return 1;
    });
    const t0 = Date.now();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).resolves.toBe(1);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(10);
    spy.mockRestore();
  });
});
//# sourceMappingURL=retry-strategies.test.js.map
