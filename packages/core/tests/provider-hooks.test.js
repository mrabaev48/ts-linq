'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const sqlite_1 = require('@ts-linq/sqlite');
class HookedProvider extends sqlite_1.SQLiteProvider {
  constructor() {
    super(...arguments);
    this.before = [];
    this.after = [];
  }
  async beforeExecute(sql, params) {
    this.before.push(sql);
  }
  async afterExecute(sql, params, result) {
    this.after.push(sql);
  }
}
describe('DatabaseProvider Template Method hooks', () => {
  it('invokes before/after hooks', async () => {
    const provider = new HookedProvider(':memory:');
    await provider.connect();
    await provider.executeNonQuery('CREATE TABLE t (id INTEGER)');
    await provider.executeQuery('SELECT 1');
    expect(provider.before.length).toBeGreaterThan(0);
    expect(provider.after.length).toBeGreaterThan(0);
    await provider.disconnect();
  });
});
//# sourceMappingURL=provider-hooks.test.js.map
