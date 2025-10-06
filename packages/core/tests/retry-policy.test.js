'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const sqlite_1 = require('@ts-linq/sqlite');
class FlakyProvider extends sqlite_1.SQLiteProvider {
  constructor(failTimes) {
    super(':memory:');
    this.failCount = 0;
    this.failCount = failTimes;
  }
  async connect() {
    /* no-op */
  }
  async disconnect() {
    /* no-op */
  }
  async doExecuteQuery(sql, params = []) {
    if (this.failCount > 0 && !this.inTransactionState) {
      this.failCount--;
      const err = new Error('transient timeout');
      err.message = 'Timeout occurred';
      throw err;
    }
    return [];
  }
  async doExecuteNonQuery(sql, params = []) {
    if (this.failCount > 0 && !this.inTransactionState) {
      this.failCount--;
      const err = new Error('connection lost');
      err.message = 'Connection lost';
      throw err;
    }
    return 1;
  }
}
describe('Provider retry policy', () => {
  it('retries up to maxAttempts for transient errors when not in transaction', async () => {
    const p = new FlakyProvider(2);
    await p.connect();
    const t0 = Date.now();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).resolves.toBe(1);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(50); // at least one backoff
    await p.disconnect();
  });
  it('does not retry inside explicit transaction', async () => {
    const p = new FlakyProvider(1);
    await p.connect();
    await p.beginTransaction();
    // В транзакции doExecuteNonQuery отдаст 1 без ретраев — поэтому симулируем ошибку через spy
    const pobj = p;
    const spy = jest.spyOn(pobj, 'doExecuteNonQuery').mockImplementation(() => {
      const err = new Error('deadlock');
      err.message = 'deadlock';
      throw err;
    });
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    spy.mockRestore();
    await p.rollbackTransaction();
    await p.disconnect();
  });
});
//# sourceMappingURL=retry-policy.test.js.map
